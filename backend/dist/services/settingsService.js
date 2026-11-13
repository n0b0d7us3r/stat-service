import { getUserDb } from '../db/userDb.js';
import { queryAll, runStatement } from '../query.js';
import { DbError } from './projectsService.js';
export const FINANCE_CURRENCIES = ['BYN', 'USD', 'RUB', 'EUR', 'GEL'];
const DEFAULT_SETTINGS = {
    baseCurrency: 'BYN',
    hiddenBalanceAccounts: [],
    enabledCurrencies: [...FINANCE_CURRENCIES],
};
const BALANCE_ACCOUNT_KEY = /^(\d+|none)$/;
function parseEnabledCurrencies(value, baseCurrency) {
    const known = FINANCE_CURRENCIES;
    if (!value) {
        return [...DEFAULT_SETTINGS.enabledCurrencies];
    }
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [...DEFAULT_SETTINGS.enabledCurrencies];
        }
        const enabled = [...new Set(parsed
                .map(String)
                .map((code) => code.trim().toUpperCase())
                .filter((code) => known.includes(code)))];
        const base = known.includes(baseCurrency) ? baseCurrency : DEFAULT_SETTINGS.baseCurrency;
        if (!enabled.includes(base)) {
            enabled.unshift(base);
        }
        return enabled.length > 0 ? enabled : [...DEFAULT_SETTINGS.enabledCurrencies];
    }
    catch {
        return [...DEFAULT_SETTINGS.enabledCurrencies];
    }
}
function parseHiddenAccounts(value) {
    if (!value)
        return DEFAULT_SETTINGS.hiddenBalanceAccounts;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String).filter((key) => BALANCE_ACCOUNT_KEY.test(key)) : [];
    }
    catch {
        return [];
    }
}
function saveSetting(userId, key, value) {
    runStatement(getUserDb(userId), 'INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}
export function getUserSettings(userId) {
    const rows = queryAll(getUserDb(userId), 'SELECT key, value FROM user_settings');
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const baseCurrency = stored.baseCurrency ?? DEFAULT_SETTINGS.baseCurrency;
    return {
        baseCurrency,
        hiddenBalanceAccounts: parseHiddenAccounts(stored.hiddenBalanceAccounts),
        enabledCurrencies: parseEnabledCurrencies(stored.enabledCurrencies, baseCurrency),
    };
}
function normalizeEnabledCurrencies(input, baseCurrency) {
    if (!Array.isArray(input) || input.length === 0) {
        throw new DbError('Выберите хотя бы одну валюту');
    }
    const known = FINANCE_CURRENCIES;
    const enabled = [...new Set(input
            .map(String)
            .map((code) => code.trim().toUpperCase())
            .filter((code) => known.includes(code)))];
    if (!known.includes(baseCurrency)) {
        throw new DbError('Некорректная валюта');
    }
    if (!enabled.includes(baseCurrency)) {
        enabled.unshift(baseCurrency);
    }
    if (enabled.length === 0) {
        throw new DbError('Выберите хотя бы одну валюту');
    }
    return enabled;
}
export function updateUserSettings(userId, input) {
    const current = getUserSettings(userId);
    let baseCurrency = current.baseCurrency;
    if (input.baseCurrency !== undefined) {
        const currency = String(input.baseCurrency).trim().toUpperCase();
        if (!FINANCE_CURRENCIES.includes(currency)) {
            throw new DbError('Некорректная валюта');
        }
        if (!current.enabledCurrencies.includes(currency)) {
            throw new DbError('Сначала включите валюту в списке');
        }
        baseCurrency = currency;
        saveSetting(userId, 'baseCurrency', currency);
    }
    if (input.enabledCurrencies !== undefined) {
        const enabled = normalizeEnabledCurrencies(input.enabledCurrencies, baseCurrency);
        saveSetting(userId, 'enabledCurrencies', JSON.stringify(enabled));
    }
    if (input.hiddenBalanceAccounts !== undefined) {
        const list = input.hiddenBalanceAccounts;
        if (!Array.isArray(list) || !list.every((key) => BALANCE_ACCOUNT_KEY.test(String(key)))) {
            throw new DbError('Некорректный список счетов');
        }
        saveSetting(userId, 'hiddenBalanceAccounts', JSON.stringify([...new Set(list.map(String))]));
    }
    return getUserSettings(userId);
}
