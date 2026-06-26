import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { applySchema } from './schema';
import { loadDatabase, saveDatabase } from './persistence';
import { seedInitialAdmin } from './seed';

let sqlJs: SqlJsStatic | null = null;
let db: Database | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: () => wasmUrl,
    });
  }
  return sqlJs;
}

function schedulePersist(): void {
  if (!db) return;

  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    if (!db) return;
    const data = db.export();
    void saveDatabase(data);
  }, 300);
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await getSqlJs();
  const saved = await loadDatabase();

  db = saved ? new SQL.Database(saved) : new SQL.Database();
  applySchema(db);
  await seedInitialAdmin();

  if (!saved) {
    await saveDatabase(db.export());
  }

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database is not initialized. Call initDatabase() first.');
  }
  return db;
}

export function persistDatabase(): void {
  schedulePersist();
}

export async function flushDatabase(): Promise<void> {
  if (!db) return;

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  await saveDatabase(db.export());
}
