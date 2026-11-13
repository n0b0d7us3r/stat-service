import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from '../config.js';
import { hashPassword, verifyPassword } from '../crypto.js';
import { getAuthDb } from '../db/authDb.js';
import { createUserDatabase, getUserDb } from '../db/userDb.js';
import { queryExists, queryOne } from '../query.js';
export class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthError';
    }
}
function mapUser(row) {
    return {
        id: row.id,
        email: row.email,
        is_admin: row.is_admin === 1,
        created_at: row.created_at,
    };
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
export function getUserById(userId) {
    const row = queryOne(getAuthDb(), 'SELECT id, email, password_hash, password_salt, is_admin, created_at FROM users WHERE id = ?', [userId]);
    return row ? mapUser(row) : null;
}
export function registerUser(email, password) {
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
    const result = authDb.prepare('INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)').run(normalizedEmail, hash, salt);
    const userId = Number(result.lastInsertRowid);
    createUserDatabase(userId, normalizedEmail, false);
    const user = getUserById(userId);
    if (!user) {
        throw new AuthError('Не удалось создать пользователя');
    }
    return user;
}
export function loginUser(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const row = queryOne(getAuthDb(), 'SELECT id, email, password_hash, password_salt, is_admin, created_at FROM users WHERE email = ?', [normalizedEmail]);
    if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
        throw new AuthError('Неверный email или пароль');
    }
    return mapUser(row);
}
export function verifyUserPassword(userId, password) {
    if (!password) {
        return false;
    }
    const row = queryOne(getAuthDb(), 'SELECT password_hash, password_salt FROM users WHERE id = ?', [userId]);
    if (!row) {
        return false;
    }
    return verifyPassword(password, row.password_hash, row.password_salt);
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
function assertCurrentPassword(userId, password) {
    if (typeof password !== 'string' || !verifyUserPassword(userId, password)) {
        throw new AuthError('Неверный текущий пароль');
    }
}
export function changeUserEmail(userId, currentPassword, rawEmail) {
    assertCurrentPassword(userId, currentPassword);
    const email = typeof rawEmail === 'string' ? normalizeEmail(rawEmail) : '';
    if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
        throw new AuthError('Некорректный email');
    }
    const authDb = getAuthDb();
    const current = getUserById(userId);
    if (current?.email === email) {
        throw new AuthError('Это ваш текущий email');
    }
    if (queryExists(authDb, 'SELECT id FROM users WHERE email = ? AND id != ?', [email, userId])) {
        throw new AuthError('Пользователь с таким email уже существует');
    }
    authDb.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
    getUserDb(userId).prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
    const user = getUserById(userId);
    if (!user) {
        throw new AuthError('Сессия недействительна');
    }
    return user;
}
export function changeUserPassword(userId, currentPassword, newPassword) {
    assertCurrentPassword(userId, currentPassword);
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new AuthError('Пароль должен содержать минимум 6 символов');
    }
    const { hash, salt } = hashPassword(newPassword);
    getAuthDb()
        .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
        .run(hash, salt, userId);
}
export async function seedInitialAdmin() {
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
    const result = authDb.prepare('INSERT INTO users (email, password_hash, password_salt, is_admin) VALUES (?, ?, ?, 1)').run(email, hash, salt);
    const userId = Number(result.lastInsertRowid);
    createUserDatabase(userId, email, true);
}
