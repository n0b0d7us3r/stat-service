import fs from 'node:fs';
import path from 'node:path';
export const DATA_DIR = process.env.DATA_DIR ?? '/data';
export const USERS_DIR = path.join(DATA_DIR, 'users');
export const AUTH_DB_PATH = path.join(DATA_DIR, 'auth.sqlite');
export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
export const PORT = Number(process.env.PORT ?? 9000);
export const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
export const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';
export function ensureDataDirs() {
    fs.mkdirSync(USERS_DIR, { recursive: true });
}
export function userDbPath(userId) {
    return path.join(USERS_DIR, `${userId}.sqlite`);
}
