import { flushDatabase, getDatabase, persistDatabase } from './database';
import { hashPassword } from './crypto';
import { queryExists } from './query';

export async function seedInitialAdmin(): Promise<void> {
  const email = import.meta.env.VITE_SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = import.meta.env.VITE_SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const db = getDatabase();

  if (queryExists(db, 'SELECT id FROM users LIMIT 1')) {
    return;
  }

  const { hash, salt } = await hashPassword(password);

  db.run(
    'INSERT INTO users (email, password_hash, password_salt, is_admin) VALUES (?, ?, ?, 1)',
    [email, hash, salt],
  );

  persistDatabase();
  await flushDatabase();
}
