import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import { getUserDb } from '../db/userDb.js';
import { queryOne, runStatement } from '../query.js';
import { DbError } from './projectsService.js';
import { FINANCE_CURRENCIES, getUserSettings } from './settingsService.js';
const CACHE_PATH = path.join(DATA_DIR, 'exchange-rates.json');
const MYFIN_URL = 'https://myfin.by/bank/kursy_valjut_nbrb';
const NBRB_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0';
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RATE = 1_000_000;
const OVERRIDE_KEY = 'rateOverride';
let cache = null;
let refreshing = null;
function loadCache() {
    if (cache)
        return cache;
    try {
        const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
        if (parsed && typeof parsed.rates === 'object')
            cache = parsed;
    }
    catch {
        cache = null;
    }
    return cache;
}
function saveCache(next) {
    cache = next;
    try {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(next, null, 2));
    }
    catch (error) {
        console.error('Не удалось сохранить курсы валют', error);
    }
}
function pickSupported(rates) {
    const result = {};
    for (const code of FINANCE_CURRENCIES) {
        const value = rates[code];
        if (code !== 'BYN' && Number.isFinite(value) && value > 0)
            result[code] = value;
    }
    return result;
}
export function parseMyfinRates(html) {
    const rates = {};
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    for (const [, row] of html.matchAll(rowPattern)) {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => (cell.replace(/<[^>]+>/g, '').trim()));
        if (cells.length < 4)
            continue;
        const rate = Number(cells[1].replace(',', '.'));
        const code = cells[2].toUpperCase();
        const units = Number(cells[3]);
        if (/^[A-Z]{3}$/.test(code) && rate > 0 && units > 0) {
            rates[code] = rate / units;
        }
    }
    return rates;
}
async function fetchText(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (stat-service exchange rates)' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    return response.text();
}
async function fetchFromMyfin() {
    return pickSupported(parseMyfinRates(await fetchText(MYFIN_URL)));
}
async function fetchFromNbrb() {
    const list = JSON.parse(await fetchText(NBRB_URL));
    const rates = {};
    for (const item of list) {
        if (item.Cur_Scale > 0)
            rates[item.Cur_Abbreviation] = item.Cur_OfficialRate / item.Cur_Scale;
    }
    return pickSupported(rates);
}
const REQUIRED_CODES = FINANCE_CURRENCIES.filter((code) => code !== 'BYN');
function mergeMarketRates(previous, fresh) {
    return pickSupported({ ...(previous ?? {}), ...fresh });
}
async function doRefresh() {
    const previous = loadCache();
    const sources = [
        ['nbrb', fetchFromNbrb],
        ['myfin', fetchFromMyfin],
    ];
    let best = previous;
    for (const [source, load] of sources) {
        try {
            const rates = mergeMarketRates(previous?.rates, await load());
            if (Object.keys(rates).length === 0)
                continue;
            const next = { source, fetchedAt: new Date().toISOString(), rates };
            saveCache(next);
            best = next;
            if (REQUIRED_CODES.every((code) => code in rates))
                return next;
            const missing = REQUIRED_CODES.filter((code) => !(code in rates));
            console.warn(`Курсы ${source}: после слияния нет`, missing);
        }
        catch (error) {
            console.warn(`Не удалось получить курсы ${source}:`, error.message);
        }
    }
    return best;
}
/** При ошибке обоих источников остаётся последний сохранённый курс. */
export function refreshMarketRates() {
    refreshing ??= doRefresh().finally(() => {
        refreshing = null;
    });
    return refreshing;
}
function isStale(current) {
    if (!current)
        return true;
    return Date.now() - new Date(current.fetchedAt).getTime() > REFRESH_INTERVAL_MS;
}
function getMarketRates() {
    const current = loadCache();
    if (isStale(current))
        void refreshMarketRates();
    return current;
}
export function startExchangeRatesUpdater() {
    void refreshMarketRates();
    setInterval(() => void refreshMarketRates(), REFRESH_INTERVAL_MS).unref();
}
function readCustomRates(userId, base) {
    const row = queryOne(getUserDb(userId), 'SELECT value FROM user_settings WHERE key = ?', [OVERRIDE_KEY]);
    if (!row)
        return null;
    try {
        const parsed = JSON.parse(row.value);
        return parsed.base === base && parsed.rates && typeof parsed.rates === 'object' ? parsed : null;
    }
    catch {
        return null;
    }
}
export function clearCustomRates(userId) {
    runStatement(getUserDb(userId), 'DELETE FROM user_settings WHERE key = ?', [OVERRIDE_KEY]);
}
function marketRateToBase(code, base, market) {
    const bynPer = (currency) => (currency === 'BYN' ? 1 : market?.rates[currency]);
    const from = bynPer(code);
    const to = bynPer(base);
    if (!from || !to)
        return undefined;
    return Number((from / to).toPrecision(12));
}
export function getTodayRates(userId) {
    const { baseCurrency: base, enabledCurrencies } = getUserSettings(userId);
    const market = getMarketRates();
    const custom = readCustomRates(userId, base);
    const marketRates = {};
    for (const code of FINANCE_CURRENCIES) {
        if (code === base)
            continue;
        const value = marketRateToBase(code, base, market);
        if (value)
            marketRates[code] = value;
    }
    const rates = {};
    const manual = [];
    for (const code of enabledCurrencies) {
        if (code === base)
            continue;
        const customRate = custom?.rates[code];
        if (customRate) {
            rates[code] = customRate;
            manual.push(code);
            continue;
        }
        const fromMarket = marketRates[code];
        if (fromMarket)
            rates[code] = fromMarket;
    }
    return {
        base,
        rates,
        manual,
        marketRates,
        customRates: { ...(custom?.rates ?? {}) },
        market: market ? { source: market.source, fetchedAt: market.fetchedAt } : null,
    };
}
export function setRateOverride(userId, input) {
    const { baseCurrency: base } = getUserSettings(userId);
    const rates = {};
    if (input && typeof input === 'object') {
        for (const [code, raw] of Object.entries(input)) {
            if (raw === null || raw === '' || raw === undefined)
                continue;
            if (code === base || !FINANCE_CURRENCIES.includes(code)) {
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
    }
    else {
        const store = { base, rates };
        runStatement(db, 'INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [OVERRIDE_KEY, JSON.stringify(store)]);
    }
    return getTodayRates(userId);
}
