import { flushDatabase, getDatabase, persistDatabase } from './database';
import { hashPassword, verifyPassword } from './crypto';
import { queryExists, queryOne } from './query';
import { AuthError, type AuthSession, type User } from './types';

const SESSION_KEY = 'game_stat_session';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapUser(row: { id: number; email: string; is_admin: number; created_at: string }): User {
  return {
    id: row.id,
    email: row.email,
    is_admin: row.is_admin === 1,
    created_at: row.created_at,
  };
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (typeof parsed.userId === 'number' && typeof parsed.email === 'string') {
      return parsed;
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  return null;
}

function storeSession(session: AuthSession, remember: boolean): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);

  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export async function registerUser(email: string, password: string): Promise<User> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AuthError('Email и пароль обязательны');
  }

  if (password.length < 6) {
    throw new AuthError('Пароль должен содержать минимум 6 символов');
  }

  const db = getDatabase();
  if (queryExists(db, 'SELECT id FROM users WHERE email = ?', [normalizedEmail])) {
    throw new AuthError('Пользователь с таким email уже существует');
  }

  const { hash, salt } = await hashPassword(password);

  db.run(
    'INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)',
    [normalizedEmail, hash, salt],
  );

  persistDatabase();
  await flushDatabase();

  const row = queryOne<{ id: number; email: string; is_admin: number; created_at: string }>(
    db,
    'SELECT id, email, is_admin, created_at FROM users WHERE email = ?',
    [normalizedEmail],
  );

  if (!row) {
    throw new AuthError('Не удалось создать пользователя');
  }

  return mapUser(row);
}

export async function loginUser(email: string, password: string, remember = false): Promise<AuthSession> {
  const normalizedEmail = normalizeEmail(email);
  const db = getDatabase();

  const row = queryOne<{
    id: number;
    email: string;
    password_hash: string;
    password_salt: string;
  }>(
    db,
    'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?',
    [normalizedEmail],
  );

  if (!row) {
    throw new AuthError('Неверный email или пароль');
  }

  const userId = row.id;
  const userEmail = row.email;
  const passwordHash = row.password_hash;
  const passwordSalt = row.password_salt;

  const isValid = await verifyPassword(password, passwordHash, passwordSalt);
  if (!isValid) {
    throw new AuthError('Неверный email или пароль');
  }

  const session: AuthSession = { userId, email: userEmail };
  storeSession(session, remember);
  return session;
}

export function logoutUser(): void {
  clearSession();
}

export function getCurrentUser(): User | null {
  const session = getStoredSession();
  if (!session) return null;

  const db = getDatabase();
  const row = queryOne<{ id: number; email: string; is_admin: number; created_at: string }>(
    db,
    'SELECT id, email, is_admin, created_at FROM users WHERE id = ?',
    [session.userId],
  );

  if (!row) {
    clearSession();
    return null;
  }

  return mapUser(row);
}

export async function verifyUserPassword(userId: number, password: string): Promise<boolean> {
  if (!password) {
    return false;
  }

  const db = getDatabase();
  const row = queryOne<{ password_hash: string; password_salt: string }>(
    db,
    'SELECT password_hash, password_salt FROM users WHERE id = ?',
    [userId],
  );

  if (!row) {
    return false;
  }

  return verifyPassword(password, row.password_hash, row.password_salt);
}
