import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import { getUserDb } from '../db/userDb.js';
import { queryOne, runStatement } from '../query.js';
import { DbError } from './projectsService.js';
import { FINANCE_CURRENCIES, getUserSettings } from './settingsService.js';

export type MarketRateSource = 'myfin' | 'nbrb' | 'nbg';

/** Курсы НБРБ: сколько BYN за 1 единицу валюты; NBG — сколько GEL за 1 единицу. */
interface MarketRatesCache {
  source: MarketRateSource;
  fetchedAt: string;
  rates: Record<string, number>;
  nbg?: { fetchedAt: string; rates: Record<string, number> };
}

export interface TodayRates {
  base: string;
  /** Сколько основной валюты за 1 единицу валюты; кастомный курс имеет приоритет. */
  rates: Record<string, number>;
  manual: string[];
  /** Рыночный курс к основной валюте (без кастомных). */
  marketRates: Record<string, number>;
  /** Сохранённые кастомные курсы (до обновления с биржи). */
  customRates: Record<string, number>;
  market: { source: MarketRateSource; fetchedAt: string } | null;
}

interface CustomRatesStore {
  base: string;
  rates: Record<string, number>;
}

const CACHE_PATH = path.join(DATA_DIR, 'exchange-rates.json');
const MYFIN_URL = 'https://myfin.by/bank/kursy_valjut_nbrb';
const NBRB_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0';
const NBG_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RATE = 1_000_000;
const OVERRIDE_KEY = 'rateOverride';

let cache: MarketRatesCache | null = null;
let refreshing: Promise<MarketRatesCache | null> | null = null;

function loadCache(): MarketRatesCache | null {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as MarketRatesCache;
    if (parsed && typeof parsed.rates === 'object') cache = parsed;
  } catch {
    cache = null;
  }
  return cache;
}

function saveCache(next: MarketRatesCache): void {
  cache = next;
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(next, null, 2));
  } catch (error) {
    console.error('Не удалось сохранить курсы валют', error);
  }
}

function pickSupported(rates: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const code of FINANCE_CURRENCIES) {
    const value = rates[code];
    if (code !== 'BYN' && Number.isFinite(value) && value > 0) result[code] = value;
  }
  return result;
}

function pickSupportedGel(rates: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const code of FINANCE_CURRENCIES) {
    if (code === 'GEL') continue;
    const value = rates[code];
    if (Number.isFinite(value) && value > 0) result[code] = value;
  }
  return result;
}

export function parseMyfinRates(html: string): Record<string, number> {
  const rates: Record<string, number> = {};
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  for (const [, row] of html.matchAll(rowPattern)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => (
      cell.replace(/<[^>]+>/g, '').trim()
    ));
    if (cells.length < 4) continue;
    const rate = Number(cells[1].replace(',', '.'));
    const code = cells[2].toUpperCase();
    const units = Number(cells[3]);
    if (/^[A-Z]{3}$/.test(code) && rate > 0 && units > 0) {
      rates[code] = rate / units;
    }
  }
  return rates;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (stat-service exchange rates)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchFromMyfin(): Promise<Record<string, number>> {
  return pickSupported(parseMyfinRates(await fetchText(MYFIN_URL)));
}

async function fetchFromNbrb(): Promise<Record<string, number>> {
  const list = JSON.parse(await fetchText(NBRB_URL)) as Array<{
    Cur_Abbreviation: string;
    Cur_Scale: number;
    Cur_OfficialRate: number;
  }>;
  const rates: Record<string, number> = {};
  for (const item of list) {
    if (item.Cur_Scale > 0) rates[item.Cur_Abbreviation] = item.Cur_OfficialRate / item.Cur_Scale;
  }
  return pickSupported(rates);
}

/** Официальные курсы NBG: GEL за `quantity` единиц валюты. */
export function parseNbgRates(payload: unknown): Record<string, number> {
  if (!Array.isArray(payload) || payload.length === 0) return {};
  const block = payload[0] as { currencies?: unknown };
  if (!Array.isArray(block.currencies)) return {};
  const rates: Record<string, number> = {};
  for (const raw of block.currencies) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { code?: string; quantity?: number; rate?: number };
    const code = String(item.code ?? '').toUpperCase();
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    if (/^[A-Z]{3}$/.test(code) && quantity > 0 && rate > 0) {
      rates[code] = rate / quantity;
    }
  }
  return rates;
}

async function fetchFromNbg(): Promise<Record<string, number>> {
  return pickSupportedGel(parseNbgRates(JSON.parse(await fetchText(NBG_URL))));
}

const REQUIRED_CODES = FINANCE_CURRENCIES.filter((code) => code !== 'BYN');
const REQUIRED_GEL_CODES = FINANCE_CURRENCIES.filter((code) => code !== 'GEL');

function mergeMarketRates(previous: Record<string, number> | undefined, fresh: Record<string, number>): Record<string, number> {
  return pickSupported({ ...(previous ?? {}), ...fresh });
}

function mergeGelMarketRates(previous: Record<string, number> | undefined, fresh: Record<string, number>): Record<string, number> {
  return pickSupportedGel({ ...(previous ?? {}), ...fresh });
}

async function doRefresh(): Promise<MarketRatesCache | null> {
  const previous = loadCache();
  const sources: Array<[MarketRateSource, () => Promise<Record<string, number>>]> = [
    ['nbrb', fetchFromNbrb],
    ['myfin', fetchFromMyfin],
  ];
  let rates = { ...(previous?.rates ?? {}) };
  let source: MarketRateSource = previous?.source ?? 'nbrb';
  let nbg = previous?.nbg;
  let touched = false;

  for (const [src, load] of sources) {
    try {
      const merged = mergeMarketRates(rates, await load());
      if (Object.keys(merged).length === 0) continue;
      rates = merged;
      source = src;
      touched = true;
      if (REQUIRED_CODES.every((code) => code in rates)) break;
      const missing = REQUIRED_CODES.filter((code) => !(code in rates));
      console.warn(`Курсы ${src}: после слияния нет`, missing);
    } catch (error) {
      console.warn(`Не удалось получить курсы ${src}:`, (error as Error).message);
    }
  }

  try {
    const gelMerged = mergeGelMarketRates(nbg?.rates, await fetchFromNbg());
    if (Object.keys(gelMerged).length > 0) {
      nbg = { fetchedAt: new Date().toISOString(), rates: gelMerged };
      touched = true;
      const missingGel = REQUIRED_GEL_CODES.filter((code) => !(code in gelMerged));
      if (missingGel.length > 0) console.warn('Курсы nbg: после слияния нет', missingGel);
    }
  } catch (error) {
    console.warn('Не удалось получить курсы nbg:', (error as Error).message);
  }

  if (!touched) return previous;

  const next: MarketRatesCache = {
    source,
    fetchedAt: new Date().toISOString(),
    rates,
    ...(nbg ? { nbg } : {}),
  };
  saveCache(next);
  return next;
}

/** При ошибке обоих источников остаётся последний сохранённый курс. */
export function refreshMarketRates(): Promise<MarketRatesCache | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function isStale(current: MarketRatesCache | null): boolean {
  if (!current) return true;
  return Date.now() - new Date(current.fetchedAt).getTime() > REFRESH_INTERVAL_MS;
}

function getMarketRates(): MarketRatesCache | null {
  const current = loadCache();
  if (isStale(current)) void refreshMarketRates();
  return current;
}

export function startExchangeRatesUpdater(): void {
  void refreshMarketRates();
  setInterval(() => void refreshMarketRates(), REFRESH_INTERVAL_MS).unref();
}

function readCustomRates(userId: number, base: string): CustomRatesStore | null {
  const row = queryOne<{ value: string }>(
    getUserDb(userId),
    'SELECT value FROM user_settings WHERE key = ?',
    [OVERRIDE_KEY],
  );
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as CustomRatesStore;
    return parsed.base === base && parsed.rates && typeof parsed.rates === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCustomRates(userId: number): void {
  runStatement(getUserDb(userId), 'DELETE FROM user_settings WHERE key = ?', [OVERRIDE_KEY]);
}

function crossViaReference(
  code: string,
  base: string,
  reference: string,
  table: Record<string, number>,
): number | undefined {
  const inRef = (currency: string) => (currency === reference ? 1 : table[currency]);
  const from = inRef(code);
  const to = inRef(base);
  if (!from || !to) return undefined;
  return Number((from / to).toPrecision(12));
}

function canUseGelLadder(code: string, base: string, gelRates: Record<string, number>): boolean {
  const present = (currency: string) =>
    currency === 'GEL' || (Number.isFinite(gelRates[currency]) && gelRates[currency] > 0);
  return present(code) && present(base);
}

function marketRateToBase(
  code: string,
  base: string,
  market: MarketRatesCache | null,
): number | undefined {
  if (!market) return undefined;
  const gel = market.nbg?.rates;
  if (gel && canUseGelLadder(code, base, gel)) {
    return crossViaReference(code, base, 'GEL', gel);
  }
  if (!market.rates) return undefined;
  return crossViaReference(code, base, 'BYN', market.rates);
}

function marketMetaForBase(base: string, market: MarketRatesCache | null): TodayRates['market'] {
  if (!market) return null;
  if (base === 'GEL' && market.nbg) {
    return { source: 'nbg', fetchedAt: market.nbg.fetchedAt };
  }
  return { source: market.source, fetchedAt: market.fetchedAt };
}

export function getTodayRates(userId: number): TodayRates {
  const { baseCurrency: base, enabledCurrencies } = getUserSettings(userId);
  const market = getMarketRates();
  const custom = readCustomRates(userId, base);

  const marketRates: Record<string, number> = {};
  for (const code of FINANCE_CURRENCIES) {
    if (code === base) continue;
    const value = marketRateToBase(code, base, market);
    if (value) marketRates[code] = value;
  }

  const rates: Record<string, number> = {};
  const manual: string[] = [];
  for (const code of enabledCurrencies) {
    if (code === base) continue;
    const customRate = custom?.rates[code];
    if (customRate) {
      rates[code] = customRate;
      manual.push(code);
      continue;
    }
    const fromMarket = marketRates[code];
    if (fromMarket) rates[code] = fromMarket;
  }

  return {
    base,
    rates,
    manual,
    marketRates,
    customRates: { ...(custom?.rates ?? {}) },
    market: marketMetaForBase(base, market),
  };
}

export function setRateOverride(userId: number, input: unknown): TodayRates {
  const { baseCurrency: base } = getUserSettings(userId);
  const rates: Record<string, number> = {};

  if (input && typeof input === 'object') {
    for (const [code, raw] of Object.entries(input as Record<string, unknown>)) {
      if (raw === null || raw === '' || raw === undefined) continue;
      if (code === base || !(FINANCE_CURRENCIES as readonly string[]).includes(code)) {
        throw new DbError('Некорректная валюта');
      }
      const value = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_RATE) {
        throw new DbError('Укажите курс валюты');
      }
      rates[code] = Number(value.toPrecision(12));
    }
  }

  const db = getUserDb(userId);
  if (Object.keys(rates).length === 0) {
    clearCustomRates(userId);
  } else {
    const store: CustomRatesStore = { base, rates };
    runStatement(
      db,
      'INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [OVERRIDE_KEY, JSON.stringify(store)],
    );
  }

  return getTodayRates(userId);
}
