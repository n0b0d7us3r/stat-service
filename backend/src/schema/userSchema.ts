import type Database from 'better-sqlite3';

function getSchemaVersion(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    )
  `);

  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
  return row?.version ?? 0;
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.exec('DELETE FROM schema_version');
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function migrateToV1(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      password_salt TEXT NOT NULL DEFAULT '',
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function migrateToV2(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS marked_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE (project_id, date)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_marked_days_project_id ON marked_days(project_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_marked_days_date ON marked_days(date)');
}

function migrateToV3(db: Database.Database): void {
  if (!columnExists(db, 'users', 'is_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  }
}

function migrateToV4(db: Database.Database): void {
  if (!columnExists(db, 'projects', 'project_type')) {
    db.exec("ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'calendar'");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS day_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE (project_id, date)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_day_notes_project_id ON day_notes(project_id)');
}

function migrateToV5(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      streak_days INTEGER NOT NULL,
      project_type TEXT NOT NULL DEFAULT 'calendar'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE (user_id, achievement_id)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id)');
}

function migrateToV6(db: Database.Database): void {
  if (!columnExists(db, 'projects', 'is_mutable')) {
    db.exec('ALTER TABLE projects ADD COLUMN is_mutable INTEGER NOT NULL DEFAULT 0');
  }
}

function migrateToV7(db: Database.Database): void {
  if (!columnExists(db, 'achievements', 'criteria_type')) {
    db.exec("ALTER TABLE achievements ADD COLUMN criteria_type TEXT NOT NULL DEFAULT 'streak'");
  }
}

export function applyUserDataSchema(db: Database.Database): void {
  let version = getSchemaVersion(db);

  if (version < 1) {
    migrateToV1(db);
    version = 1;
    setSchemaVersion(db, version);
  }

  if (version < 2) {
    migrateToV2(db);
    version = 2;
    setSchemaVersion(db, version);
  }

  if (version < 3) {
    migrateToV3(db);
    version = 3;
    setSchemaVersion(db, version);
  }

  if (version < 4) {
    migrateToV4(db);
    version = 4;
    setSchemaVersion(db, version);
  }

  if (version < 5) {
    migrateToV5(db);
    version = 5;
    setSchemaVersion(db, version);
  }

  if (version < 6) {
    migrateToV6(db);
    version = 6;
    setSchemaVersion(db, version);
  }

  if (version < 7) {
    migrateToV7(db);
    version = 7;
    setSchemaVersion(db, version);
  }
}

export function ensureOwnerUserRow(
  db: Database.Database,
  userId: number,
  email: string,
  isAdmin: boolean,
): void {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (existing) {
    return;
  }

  db.prepare(
    'INSERT INTO users (id, email, password_hash, password_salt, is_admin) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, email, '', '', isAdmin ? 1 : 0);
}
