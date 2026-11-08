import { getUserDb } from '../db/userDb.js';
import { queryAll, queryOne, runStatement } from '../query.js';
import { DbError } from './projectsService.js';
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

export interface FinanceEntry {
  id: number;
  kind: FinanceEntryKind;
  amount_cents: number;
  currency: string;
  category_id: number | null;
  date: string;
  note: string;
  created_at: string;
}

export interface FinanceOverview {
  from: string;
  to: string;
  categories: FinanceCategory[];
  entries: FinanceEntry[];
}

export const FINANCE_CURRENCIES = ['BYN', 'USD', 'EUR', 'RUB', 'PLN', 'CNY'] as const;

const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_NOTE_LENGTH = 200;
const MAX_AMOUNT_CENTS = 100_000_000_000;

const CATEGORY_COLUMNS = 'id, kind, name, color, icon, created_at';
const ENTRY_COLUMNS = 'id, kind, amount_cents, currency, category_id, date, note, created_at';

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
  const entries = queryAll<FinanceEntry>(
    db,
    `SELECT ${ENTRY_COLUMNS} FROM finance_entries WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC`,
    [start, end],
  );

  return { from: start, to: end, categories, entries };
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

export function createFinanceEntry(
  userId: number,
  input: { kind?: unknown; amount?: unknown; currency?: unknown; categoryId?: unknown; date?: unknown; note?: unknown },
): FinanceEntry {
  const db = getUserDb(userId);
  const kind = normalizeKind(input.kind);
  const amountCents = normalizeAmount(input.amount);
  const currency = normalizeCurrency(input.currency);
  const date = normalizeFinanceDate(input.date);
  const note = normalizeNote(input.note);

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

  const result = db.prepare(
    'INSERT INTO finance_entries (kind, amount_cents, currency, category_id, date, note) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(kind, amountCents, currency, categoryId, date, note);

  const entry = queryOne<FinanceEntry>(
    db,
    `SELECT ${ENTRY_COLUMNS} FROM finance_entries WHERE id = ?`,
    [Number(result.lastInsertRowid)],
  );
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
