import type Database from 'better-sqlite3';

export function queryOne<T extends object>(
  db: Database.Database,
  sql: string,
  params: unknown[] = [],
): T | null {
  const row = db.prepare(sql).get(...params) as T | undefined;
  return row ?? null;
}

export function queryExists(db: Database.Database, sql: string, params: unknown[] = []): boolean {
  return queryOne(db, sql, params) !== null;
}

export function queryAll<T extends object>(
  db: Database.Database,
  sql: string,
  params: unknown[] = [],
): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function runStatement(db: Database.Database, sql: string, params: unknown[] = []): void {
  db.prepare(sql).run(...params);
}

export function getLastInsertId(db: Database.Database): number {
  const row = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() AS id');
  return row?.id ?? 0;
}
