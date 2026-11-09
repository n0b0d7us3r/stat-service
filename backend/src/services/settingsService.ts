import { getUserDb } from '../db/userDb.js';
import { queryAll, runStatement } from '../query.js';
import { DbError } from './projectsService.js';

export const FINANCE_CURRENCIES = ['BYN', 'USD', 'EUR', 'RUB', 'PLN', 'CNY'] as const;

export interface UserSettings {
  baseCurrency: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  baseCurrency: 'BYN',
};

export function getUserSettings(userId: number): UserSettings {
  const rows = queryAll<{ key: string; value: string }>(getUserDb(userId), 'SELECT key, value FROM user_settings');
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    baseCurrency: stored.baseCurrency ?? DEFAULT_SETTINGS.baseCurrency,
  };
}

export function updateUserSettings(userId: number, input: { baseCurrency?: unknown }): UserSettings {
  const db = getUserDb(userId);

  if (input.baseCurrency !== undefined) {
    const currency = String(input.baseCurrency).trim().toUpperCase();
    if (!(FINANCE_CURRENCIES as readonly string[]).includes(currency)) {
      throw new DbError('Некорректная валюта');
    }
    runStatement(
      db,
      'INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['baseCurrency', currency],
    );
  }

  return getUserSettings(userId);
}
