import type Database from 'better-sqlite3';
import { getUserDb } from '../db/userDb.js';
import { queryAll, queryOne, runStatement } from '../query.js';
import { getTodayRates, type TodayRates } from './exchangeRatesService.js';
import { DbError } from './projectsService.js';
import { FINANCE_CURRENCIES, getUserSettings } from './settingsService.js';
import { normalizeColor } from './tasksService.js';

export type FinanceEntryKind = 'income' | 'expense';

export interface FinanceCategory {
  id: number;
  kind: FinanceEntryKind;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface FinanceAccount {
  id: number;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface FinanceEntry {
  id: number;
  kind: FinanceEntryKind;
  amount_cents: number;
  currency: string;
  category_id: number | null;
  account_id: number | null;
  rate: number | null;
  rate_currency: string | null;
  rate_mode: FinanceRateMode;
  date: string;
  note: string;
  created_at: string;
}

export type FinanceRateMode = 'fixed' | 'floating';

export interface FinanceOverview {
  from: string;
  to: string;
  baseCurrency: string;
  todayRates: TodayRates;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  entries: FinanceEntry[];
  transfers: FinanceTransfer[];
  balances: FinanceBalance[];
}

/** Остаток за всё время по счёту в конкретной валюте; account_id null — операции без счёта. */
export interface FinanceBalance {
  account_id: number | null;
  currency: string;
  cents: number;
}

export function getFinanceBalances(userId: number): FinanceBalance[] {
  const rows = queryAll<FinanceBalance>(
    getUserDb(userId),
    `SELECT account_id, currency, SUM(cents) AS cents FROM (
       SELECT account_id, currency,
              CASE kind WHEN 'income' THEN amount_cents ELSE -amount_cents END AS cents
       FROM finance_entries
       UNION ALL
       SELECT from_account_id, currency, -amount_cents FROM finance_transfers
       UNION ALL
       SELECT to_account_id, to_currency, to_amount_cents FROM finance_transfers
     )
     GROUP BY account_id, currency
     HAVING SUM(cents) != 0`,
  );
  return rows;
}

export interface FinanceTransfer {
  id: number;
  from_account_id: number | null;
  to_account_id: number | null;
  amount_cents: number;
  currency: string;
  to_amount_cents: number;
  to_currency: string;
  /** Сколько to_currency за 1 единицу currency; null, если валюта не менялась. */
  rate: number | null;
  date: string;
  note: string;
  created_at: string;
}

const MAX_RATE = 1_000_000;

const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_NOTE_LENGTH = 200;
const MAX_AMOUNT_CENTS = 100_000_000_000;

const CATEGORY_COLUMNS = 'id, kind, name, color, icon, created_at';
const ACCOUNT_COLUMNS = 'id, name, color, icon, created_at';
const ENTRY_COLUMNS =
  'id, kind, amount_cents, currency, category_id, account_id, rate, rate_currency, rate_mode, date, note, created_at';
const TRANSFER_COLUMNS =
  'id, from_account_id, to_account_id, amount_cents, currency, to_amount_cents, to_currency, rate, date, note, created_at';

function normalizeKind(value: unknown): FinanceEntryKind {
  if (value !== 'income' && value !== 'expense') {
    throw new DbError('Некорректный тип операции');
  }
  return value;
}

function normalizeCategoryName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new DbError('Укажите название раздела');
  }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new DbError('Название раздела слишком длинное');
  }
  return name;
}

function normalizeIcon(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,32}$/.test(value)) {
    throw new DbError('Выберите иконку');
  }
  return value;
}

function normalizeCurrency(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'BYN';
  }
  const currency = String(value).trim().toUpperCase();
  if (!(FINANCE_CURRENCIES as readonly string[]).includes(currency)) {
    throw new DbError('Некорректная валюта');
  }
  return currency;
}

function normalizeAmount(value: unknown): number {
  const amount = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new DbError('Некорректная сумма');
  }
  const cents = Math.round(amount * 100);
  if (cents <= 0 || cents > MAX_AMOUNT_CENTS) {
    throw new DbError('Некорректная сумма');
  }
  return cents;
}

export function normalizeFinanceDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new DbError('Некорректная дата');
  }
  const date = value.trim();
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new DbError('Некорректная дата');
  }
  return date;
}

function normalizeNote(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new DbError('Некорректный комментарий');
  }
  const note = value.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    throw new DbError('Комментарий слишком длинный');
  }
  return note;
}

export function getFinanceOverview(userId: number, from: string, to: string): FinanceOverview {
  const db = getUserDb(userId);
  const [start, end] = from <= to ? [from, to] : [to, from];
  const categories = queryAll<FinanceCategory>(
    db,
    `SELECT ${CATEGORY_COLUMNS} FROM finance_categories ORDER BY name COLLATE NOCASE ASC`,
  );
  const accounts = queryAll<FinanceAccount>(
    db,
    `SELECT ${ACCOUNT_COLUMNS} FROM finance_accounts ORDER BY name COLLATE NOCASE ASC`,
  );
  const entries = queryAll<FinanceEntry>(
    db,
    `SELECT ${ENTRY_COLUMNS} FROM finance_entries WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC`,
    [start, end],
  );
  const transfers = queryAll<FinanceTransfer>(
    db,
    `SELECT ${TRANSFER_COLUMNS} FROM finance_transfers WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC`,
    [start, end],
  );

  const { baseCurrency } = getUserSettings(userId);

  return {
    from: start,
    to: end,
    baseCurrency,
    todayRates: getTodayRates(userId),
    categories,
    accounts,
    entries,
    transfers,
    balances: getFinanceBalances(userId),
  };
}

export function createFinanceAccount(
  userId: number,
  input: { name?: unknown; color?: unknown; icon?: unknown },
): FinanceAccount {
  const db = getUserDb(userId);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new DbError('Укажите название счёта');
  }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new DbError('Название счёта слишком длинное');
  }
  const color = normalizeColor(typeof input.color === 'string' ? input.color : '', 'Выберите цвет раздела');
  const icon = normalizeIcon(input.icon);
  if (icon !== 'card' && icon !== 'cash') {
    throw new DbError('Выберите иконку');
  }

  const existing = queryAll<{ name: string }>(db, 'SELECT name FROM finance_accounts');
  if (existing.some((account) => account.name.localeCompare(name, 'ru', { sensitivity: 'accent' }) === 0)) {
    throw new DbError('Такой счёт уже есть');
  }

  const result = db.prepare('INSERT INTO finance_accounts (name, color, icon) VALUES (?, ?, ?)').run(name, color, icon);
  const account = queryOne<FinanceAccount>(
    db,
    `SELECT ${ACCOUNT_COLUMNS} FROM finance_accounts WHERE id = ?`,
    [Number(result.lastInsertRowid)],
  );
  if (!account) {
    throw new DbError('Не удалось создать счёт');
  }
  return account;
}

export function deleteFinanceAccount(userId: number, accountId: number): boolean {
  const db = getUserDb(userId);
  const existing = queryOne<{ id: number }>(db, 'SELECT id FROM finance_accounts WHERE id = ?', [accountId]);
  if (!existing) {
    return false;
  }

  db.transaction(() => {
    runStatement(db, 'UPDATE finance_entries SET account_id = NULL WHERE account_id = ?', [accountId]);
    runStatement(db, 'UPDATE finance_transfers SET from_account_id = NULL WHERE from_account_id = ?', [accountId]);
    runStatement(db, 'UPDATE finance_transfers SET to_account_id = NULL WHERE to_account_id = ?', [accountId]);
    runStatement(db, 'DELETE FROM finance_accounts WHERE id = ?', [accountId]);
  })();

  return true;
}

export function createFinanceCategory(
  userId: number,
  input: { kind?: unknown; name?: unknown; color?: unknown; icon?: unknown },
): FinanceCategory {
  const db = getUserDb(userId);
  const kind = normalizeKind(input.kind);
  const name = normalizeCategoryName(typeof input.name === 'string' ? input.name : '');
  const color = normalizeColor(typeof input.color === 'string' ? input.color : '', 'Выберите цвет раздела');
  const icon = normalizeIcon(input.icon);

  const existing = queryAll<{ name: string }>(db, 'SELECT name FROM finance_categories WHERE kind = ?', [kind]);
  if (existing.some((category) => category.name.localeCompare(name, 'ru', { sensitivity: 'accent' }) === 0)) {
    throw new DbError('Такой раздел уже есть');
  }

  const result = db.prepare(
    'INSERT INTO finance_categories (kind, name, color, icon) VALUES (?, ?, ?, ?)',
  ).run(kind, name, color, icon);
  const category = queryOne<FinanceCategory>(
    db,
    `SELECT ${CATEGORY_COLUMNS} FROM finance_categories WHERE id = ?`,
    [Number(result.lastInsertRowid)],
  );
  if (!category) {
    throw new DbError('Не удалось создать раздел');
  }
  return category;
}

export function deleteFinanceCategory(userId: number, categoryId: number): boolean {
  const db = getUserDb(userId);
  const existing = queryOne<{ id: number }>(db, 'SELECT id FROM finance_categories WHERE id = ?', [categoryId]);
  if (!existing) {
    return false;
  }

  db.transaction(() => {
    runStatement(db, 'UPDATE finance_entries SET category_id = NULL WHERE category_id = ?', [categoryId]);
    runStatement(db, 'DELETE FROM finance_categories WHERE id = ?', [categoryId]);
  })();

  return true;
}

interface FinanceEntryInput {
  amount?: unknown;
  currency?: unknown;
  categoryId?: unknown;
  accountId?: unknown;
  rate?: unknown;
  rateMode?: unknown;
  date?: unknown;
  note?: unknown;
}

function normalizeEntryInput(userId: number, db: Database.Database, kind: FinanceEntryKind, input: FinanceEntryInput) {
  const amountCents = normalizeAmount(input.amount);
  const currency = normalizeCurrency(input.currency);
  const date = normalizeFinanceDate(input.date);
  const note = normalizeNote(input.note);

  const { baseCurrency } = getUserSettings(userId);
  let rate: number | null = null;
  let rateCurrency: string | null = null;
  let rateMode: FinanceRateMode = 'fixed';
  if (currency !== baseCurrency && input.rateMode === 'floating') {
    rateMode = 'floating';
  } else if (currency !== baseCurrency) {
    const value = typeof input.rate === 'string' ? Number(input.rate.replace(',', '.')) : input.rate;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_RATE) {
      throw new DbError('Укажите курс валюты');
    }
    rate = Number(value.toPrecision(12));
    rateCurrency = baseCurrency;
  }

  const categoryId = Number(input.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new DbError(kind === 'expense' ? 'Выберите раздел расходов' : 'Выберите источник дохода');
  }
  const category = queryOne<{ kind: FinanceEntryKind }>(
    db,
    'SELECT kind FROM finance_categories WHERE id = ?',
    [categoryId],
  );
  if (!category || category.kind !== kind) {
    throw new DbError('Раздел не найден');
  }

  const accountId = Number(input.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new DbError('Выберите счёт');
  }
  if (!queryOne<{ id: number }>(db, 'SELECT id FROM finance_accounts WHERE id = ?', [accountId])) {
    throw new DbError('Счёт не найден');
  }

  return { amountCents, currency, categoryId, accountId, rate, rateCurrency, rateMode, date, note };
}

function readEntry(db: Database.Database, entryId: number): FinanceEntry | null {
  return queryOne<FinanceEntry>(db, `SELECT ${ENTRY_COLUMNS} FROM finance_entries WHERE id = ?`, [entryId]);
}

export function createFinanceEntry(userId: number, input: FinanceEntryInput & { kind?: unknown }): FinanceEntry {
  const db = getUserDb(userId);
  const kind = normalizeKind(input.kind);
  const v = normalizeEntryInput(userId, db, kind, input);

  const result = db.prepare(
    `INSERT INTO finance_entries
       (kind, amount_cents, currency, category_id, account_id, rate, rate_currency, rate_mode, date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    kind, v.amountCents, v.currency, v.categoryId, v.accountId, v.rate, v.rateCurrency, v.rateMode, v.date, v.note,
  );

  const entry = readEntry(db, Number(result.lastInsertRowid));
  if (!entry) {
    throw new DbError('Не удалось сохранить операцию');
  }
  return entry;
}

export function updateFinanceEntry(userId: number, entryId: number, input: FinanceEntryInput): FinanceEntry {
  const db = getUserDb(userId);
  const existing = readEntry(db, entryId);
  if (!existing) {
    throw new DbError('Операция не найдена');
  }
  const v = normalizeEntryInput(userId, db, existing.kind, input);

  db.prepare(
    `UPDATE finance_entries
     SET amount_cents = ?, currency = ?, category_id = ?, account_id = ?,
         rate = ?, rate_currency = ?, rate_mode = ?, date = ?, note = ?
     WHERE id = ?`,
  ).run(
    v.amountCents, v.currency, v.categoryId, v.accountId, v.rate, v.rateCurrency, v.rateMode, v.date, v.note, entryId,
  );

  const entry = readEntry(db, entryId);
  if (!entry) {
    throw new DbError('Не удалось сохранить операцию');
  }
  return entry;
}

export function deleteFinanceEntry(userId: number, entryId: number): boolean {
  const db = getUserDb(userId);
  const result = db.prepare('DELETE FROM finance_entries WHERE id = ?').run(entryId);
  return result.changes > 0;
}

interface FinanceTransferInput {
  fromAccountId?: unknown;
  toAccountId?: unknown;
  amount?: unknown;
  currency?: unknown;
  toCurrency?: unknown;
  rate?: unknown;
  date?: unknown;
  note?: unknown;
}

function requireAccount(db: Database.Database, raw: unknown): number {
  const accountId = Number(raw);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new DbError('Выберите счёт');
  }
  if (!queryOne<{ id: number }>(db, 'SELECT id FROM finance_accounts WHERE id = ?', [accountId])) {
    throw new DbError('Счёт не найден');
  }
  return accountId;
}

function normalizeTransferInput(db: Database.Database, input: FinanceTransferInput) {
  const fromAccountId = requireAccount(db, input.fromAccountId);
  const toAccountId = requireAccount(db, input.toAccountId);
  if (fromAccountId === toAccountId) {
    throw new DbError('Выберите разные счета');
  }

  const amountCents = normalizeAmount(input.amount);
  const currency = normalizeCurrency(input.currency);
  const toCurrency = normalizeCurrency(input.toCurrency ?? input.currency);
  const date = normalizeFinanceDate(input.date);
  const note = normalizeNote(input.note);

  let rate: number | null = null;
  let toAmountCents = amountCents;
  if (toCurrency !== currency) {
    const value = typeof input.rate === 'string' ? Number(input.rate.replace(',', '.')) : input.rate;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_RATE) {
      throw new DbError('Укажите курс валюты');
    }
    rate = Number(value.toPrecision(12));
    toAmountCents = Math.round(amountCents * rate);
    if (toAmountCents <= 0 || toAmountCents > MAX_AMOUNT_CENTS) {
      throw new DbError('Некорректная сумма');
    }
  }

  return { fromAccountId, toAccountId, amountCents, currency, toAmountCents, toCurrency, rate, date, note };
}

function readTransfer(db: Database.Database, transferId: number): FinanceTransfer | null {
  return queryOne<FinanceTransfer>(db, `SELECT ${TRANSFER_COLUMNS} FROM finance_transfers WHERE id = ?`, [transferId]);
}

export function createFinanceTransfer(userId: number, input: FinanceTransferInput): FinanceTransfer {
  const db = getUserDb(userId);
  const v = normalizeTransferInput(db, input);
  const result = db.prepare(
    `INSERT INTO finance_transfers
       (from_account_id, to_account_id, amount_cents, currency, to_amount_cents, to_currency, rate, date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(v.fromAccountId, v.toAccountId, v.amountCents, v.currency, v.toAmountCents, v.toCurrency, v.rate, v.date, v.note);

  const transfer = readTransfer(db, Number(result.lastInsertRowid));
  if (!transfer) {
    throw new DbError('Не удалось сохранить перевод');
  }
  return transfer;
}

export function updateFinanceTransfer(userId: number, transferId: number, input: FinanceTransferInput): FinanceTransfer {
  const db = getUserDb(userId);
  if (!readTransfer(db, transferId)) {
    throw new DbError('Перевод не найден');
  }
  const v = normalizeTransferInput(db, input);
  db.prepare(
    `UPDATE finance_transfers
     SET from_account_id = ?, to_account_id = ?, amount_cents = ?, currency = ?,
         to_amount_cents = ?, to_currency = ?, rate = ?, date = ?, note = ?
     WHERE id = ?`,
  ).run(
    v.fromAccountId, v.toAccountId, v.amountCents, v.currency,
    v.toAmountCents, v.toCurrency, v.rate, v.date, v.note, transferId,
  );

  const transfer = readTransfer(db, transferId);
  if (!transfer) {
    throw new DbError('Не удалось сохранить перевод');
  }
  return transfer;
}

export function deleteFinanceTransfer(userId: number, transferId: number): boolean {
  const result = getUserDb(userId).prepare('DELETE FROM finance_transfers WHERE id = ?').run(transferId);
  return result.changes > 0;
}
