import Database from 'better-sqlite3';
import { AUTH_DB_PATH, ensureDataDirs } from '../config.js';
import { applyAuthSchema } from '../schema/authSchema.js';

let authDb: Database.Database | null = null;

export function getAuthDb(): Database.Database {
  if (!authDb) {
    ensureDataDirs();
    authDb = new Database(AUTH_DB_PATH);
    authDb.pragma('journal_mode = WAL');
    applyAuthSchema(authDb);
  }

  return authDb;
}

export interface AuthUserRow {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  is_admin: number;
  created_at: string;
}
