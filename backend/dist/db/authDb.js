import Database from 'better-sqlite3';
import { AUTH_DB_PATH, ensureDataDirs } from '../config.js';
import { applyAuthSchema } from '../schema/authSchema.js';
let authDb = null;
export function getAuthDb() {
    if (!authDb) {
        ensureDataDirs();
        authDb = new Database(AUTH_DB_PATH);
        authDb.pragma('journal_mode = WAL');
        applyAuthSchema(authDb);
    }
    return authDb;
}
