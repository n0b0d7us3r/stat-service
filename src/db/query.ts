import type { Database, SqlValue } from 'sql.js';

export function queryOne<T extends Record<string, SqlValue>>(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): T | null {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const row = stmt.step() ? (stmt.getAsObject() as T) : null;
  stmt.free();
  return row;
}

export function queryExists(db: Database, sql: string, params: SqlValue[] = []): boolean {
  return queryOne(db, sql, params) !== null;
}

export function queryAll<T extends Record<string, SqlValue>>(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }

  stmt.free();
  return rows;
}

export function runStatement(db: Database, sql: string, params: SqlValue[] = []): void {
  db.run(sql, params);
}

export function getLastInsertId(db: Database): number {
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0]?.values[0]?.[0] as number;
}
