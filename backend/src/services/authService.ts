import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from '../config.js';
import { hashPassword, verifyPassword } from '../crypto.js';
import { getAuthDb, type AuthUserRow } from '../db/authDb.js';
import { createUserDatabase } from '../db/userDb.js';
import { queryExists, queryOne } from '../query.js';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface PublicUser {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

function mapUser(row: AuthUserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    is_admin: row.is_admin === 1,
    created_at: row.created_at,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getUserById(userId: number): PublicUser | null {
  const row = queryOne<AuthUserRow>(
    getAuthDb(),
    'SELECT id, email, password_hash, password_salt, is_admin, created_at FROM users WHERE id = ?',
    [userId],
  );

  return row ? mapUser(row) : null;
}

export function registerUser(email: string, password: string): PublicUser {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AuthError('Email и пароль обязательны');
  }

  if (password.length < 6) {
    throw new AuthError('Пароль должен содержать минимум 6 символов');
  }

  const authDb = getAuthDb();

  if (queryExists(authDb, 'SELECT id FROM users WHERE email = ?', [normalizedEmail])) {
    throw new AuthError('Пользователь с таким email уже существует');
  }

  const { hash, salt } = hashPassword(password);

  const result = authDb.prepare(
    'INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)',
  ).run(normalizedEmail, hash, salt);

  const userId = Number(result.lastInsertRowid);
  createUserDatabase(userId, normalizedEmail, false);

  const user = getUserById(userId);
  if (!user) {
    throw new AuthError('Не удалось создать пользователя');
  }

  return user;
}

export function loginUser(email: string, password: string): PublicUser {
  const normalizedEmail = normalizeEmail(email);
  const row = queryOne<AuthUserRow>(
    getAuthDb(),
    'SELECT id, email, password_hash, password_salt, is_admin, created_at FROM users WHERE email = ?',
    [normalizedEmail],
  );

  if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
    throw new AuthError('Неверный email или пароль');
  }

  return mapUser(row);
}

export function verifyUserPassword(userId: number, password: string): boolean {
  if (!password) {
    return false;
  }

  const row = queryOne<{ password_hash: string; password_salt: string }>(
    getAuthDb(),
    'SELECT password_hash, password_salt FROM users WHERE id = ?',
    [userId],
  );

  if (!row) {
    return false;
  }

  return verifyPassword(password, row.password_hash, row.password_salt);
}

export async function seedInitialAdmin(): Promise<void> {
  const email = SEED_ADMIN_EMAIL;
  const password = SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const authDb = getAuthDb();

  if (queryExists(authDb, 'SELECT id FROM users LIMIT 1')) {
    return;
  }

  const { hash, salt } = hashPassword(password);
  const result = authDb.prepare(
    'INSERT INTO users (email, password_hash, password_salt, is_admin) VALUES (?, ?, ?, 1)',
  ).run(email, hash, salt);

  const userId = Number(result.lastInsertRowid);
  createUserDatabase(userId, email, true);
}
