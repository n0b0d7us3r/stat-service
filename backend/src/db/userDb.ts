import fs from 'node:fs';
import Database from 'better-sqlite3';
import { ensureDataDirs, userDbPath } from '../config.js';
import { applyUserDataSchema, ensureOwnerUserRow } from '../schema/userSchema.js';

const cache = new Map<number, Database.Database>();

export function createUserDatabase(
  userId: number,
  email: string,
  isAdmin: boolean,
): void {
  ensureDataDirs();
  const dbPath = userDbPath(userId);

  if (fs.existsSync(dbPath)) {
    return;
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  applyUserDataSchema(db);
  ensureOwnerUserRow(db, userId, email, isAdmin);
  db.close();
}

export function getUserDb(userId: number): Database.Database {
  const cached = cache.get(userId);
  if (cached) {
    return cached;
  }

  const dbPath = userDbPath(userId);
  if (!fs.existsSync(dbPath)) {
    throw new Error('User database not found');
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  applyUserDataSchema(db);
  cache.set(userId, db);
  return db;
}

export function userDatabaseExists(userId: number): boolean {
  return fs.existsSync(userDbPath(userId));
}
