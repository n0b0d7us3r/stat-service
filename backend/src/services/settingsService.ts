import { getUserDb } from '../db/userDb.js';
import { queryAll, runStatement } from '../query.js';
import { DbError } from './projectsService.js';

export const FINANCE_CURRENCIES = ['BYN', 'USD', 'RUB'] as const;

export interface UserSettings {
  baseCurrency: string;
  /** Счета, скрытые в списке баланса: id счёта или 'none' для операций без счёта. */
  hiddenBalanceAccounts: string[];
}

const DEFAULT_SETTINGS: UserSettings = {
  baseCurrency: 'BYN',
  hiddenBalanceAccounts: [],
};

const BALANCE_ACCOUNT_KEY = /^(\d+|none)$/;

function parseHiddenAccounts(value: string | undefined): string[] {
  if (!value) return DEFAULT_SETTINGS.hiddenBalanceAccounts;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter((key) => BALANCE_ACCOUNT_KEY.test(key)) : [];
  } catch {
    return [];
  }
}

function saveSetting(userId: number, key: string, value: string): void {
  runStatement(
    getUserDb(userId),
    'INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export function getUserSettings(userId: number): UserSettings {
  const rows = queryAll<{ key: string; value: string }>(getUserDb(userId), 'SELECT key, value FROM user_settings');
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    baseCurrency: stored.baseCurrency ?? DEFAULT_SETTINGS.baseCurrency,
    hiddenBalanceAccounts: parseHiddenAccounts(stored.hiddenBalanceAccounts),
  };
}

export function updateUserSettings(
  userId: number,
  input: { baseCurrency?: unknown; hiddenBalanceAccounts?: unknown },
): UserSettings {
  if (input.baseCurrency !== undefined) {
    const currency = String(input.baseCurrency).trim().toUpperCase();
    if (!(FINANCE_CURRENCIES as readonly string[]).includes(currency)) {
      throw new DbError('Некорректная валюта');
    }
    saveSetting(userId, 'baseCurrency', currency);
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
