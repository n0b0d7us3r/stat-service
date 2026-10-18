import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR ?? '/data';
export const USERS_DIR = path.join(DATA_DIR, 'users');
export const TASK_IMAGES_DIR = path.join(DATA_DIR, 'task-images');
export const AUTH_DB_PATH = path.join(DATA_DIR, 'auth.sqlite');
export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
export const PORT = Number(process.env.PORT ?? 9000);

export const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
export const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

export function ensureDataDirs(): void {
  fs.mkdirSync(USERS_DIR, { recursive: true });
  fs.mkdirSync(TASK_IMAGES_DIR, { recursive: true });
}

export function userTaskImagesDir(userId: number): string {
  return path.join(TASK_IMAGES_DIR, String(userId));
}

export function ensureUserTaskImagesDir(userId: number): string {
  const dir = userTaskImagesDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function userDbPath(userId: number): string {
  return path.join(USERS_DIR, `${userId}.sqlite`);
}
