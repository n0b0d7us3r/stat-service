import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import { getUserDb } from '../db/userDb.js';
import { queryOne, runStatement } from '../query.js';
import { getTodayKey } from '../utils/date.js';
import { DbError } from './projectsService.js';
import { FINANCE_CURRENCIES, getUserSettings } from './settingsService.js';

export type MarketRateSource = 'myfin' | 'nbrb';

/** Курсы НБРБ: сколько BYN за 1 единицу валюты. */
interface MarketRatesCache {
  source: MarketRateSource;
  fetchedAt: string;
  rates: Record<string, number>;
}

export interface TodayRates {
  base: string;
  /** Сколько основной валюты за 1 единицу валюты; ручной курс имеет приоритет. */
  rates: Record<string, number>;
  manual: string[];
  market: { source: MarketRateSource; fetchedAt: string } | null;
}

interface RateOverride {
  date: string;
  base: string;
  rates: Record<string, number>;
}

const CACHE_PATH = path.join(DATA_DIR, 'exchange-rates.json');
const MYFIN_URL = 'https://myfin.by/bank/kursy_valjut_nbrb';
const NBRB_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0';
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

const REQUIRED_CODES = FINANCE_CURRENCIES.filter((code) => code !== 'BYN');

async function doRefresh(): Promise<MarketRatesCache | null> {
  const sources: Array<[MarketRateSource, () => Promise<Record<string, number>>]> = [
    ['nbrb', fetchFromNbrb],
    ['myfin', fetchFromMyfin],
  ];
  for (const [source, load] of sources) {
    try {
      const rates = await load();
      if (REQUIRED_CODES.every((code) => code in rates)) {
        const next = { source, fetchedAt: new Date().toISOString(), rates };
        saveCache(next);
        return next;
      }
      console.warn(`Курсы ${source}: найдены не все валюты`, Object.keys(rates));
    } catch (error) {
      console.warn(`Не удалось получить курсы ${source}:`, (error as Error).message);
    }
  }
  return loadCache();
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

function readOverride(userId: number, base: string): RateOverride | null {
  const row = queryOne<{ value: string }>(
    getUserDb(userId),
    'SELECT value FROM user_settings WHERE key = ?',
    [OVERRIDE_KEY],
  );
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as RateOverride;
    return parsed.date === getTodayKey() && parsed.base === base ? parsed : null;
  } catch {
    return null;
  }
}

export function getTodayRates(userId: number): TodayRates {
  const { baseCurrency: base } = getUserSettings(userId);
  const market = getMarketRates();
  const override = readOverride(userId, base);
  const bynPer = (code: string) => (code === 'BYN' ? 1 : market?.rates[code]);

  const rates: Record<string, number> = {};
  const manual: string[] = [];
  for (const code of FINANCE_CURRENCIES) {
    if (code === base) continue;
    const manualRate = override?.rates[code];
    if (manualRate) {
      rates[code] = manualRate;
      manual.push(code);
      continue;
    }
    const from = bynPer(code);
    const to = bynPer(base);
    if (from && to) rates[code] = Number((from / to).toPrecision(12));
  }

  return {
    base,
    rates,
    manual,
    market: market ? { source: market.source, fetchedAt: market.fetchedAt } : null,
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
    runStatement(db, 'DELETE FROM user_settings WHERE key = ?', [OVERRIDE_KEY]);
  } else {
    const override: RateOverride = { date: getTodayKey(), base, rates };
    runStatement(
      db,
      'INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [OVERRIDE_KEY, JSON.stringify(override)],
    );
  }

  return getTodayRates(userId);
}
