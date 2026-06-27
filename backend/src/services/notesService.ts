import { getUserDb } from '../db/userDb.js';
import { queryAll, queryOne, runStatement } from '../query.js';
import { getMonthPrefix } from '../utils/date.js';

export interface DayNote {
  id: number;
  project_id: number;
  date: string;
  content: string;
  updated_at: string;
}

export function getNote(userId: number, projectId: number, date: string): DayNote | null {
  const row = queryOne<DayNote>(
    getUserDb(userId),
    'SELECT id, project_id, date, content, updated_at FROM day_notes WHERE project_id = ? AND date = ?',
    [projectId, date],
  );

  return row ?? null;
}

export function getNoteDatesForMonth(userId: number, projectId: number, year: number, month: number): string[] {
  const prefix = getMonthPrefix(year, month);

  const rows = queryAll<{ date: string }>(
    getUserDb(userId),
    `
      SELECT date FROM day_notes
      WHERE project_id = ? AND date LIKE ? AND TRIM(content) != ''
      ORDER BY date
    `,
    [projectId, `${prefix}-%`],
  );

  return rows.map((row) => row.date);
}

export function saveNote(userId: number, projectId: number, date: string, content: string): DayNote {
  const db = getUserDb(userId);
  const trimmed = content.trim();
  const existing = getNote(userId, projectId, date);

  if (!trimmed) {
    if (existing) {
      runStatement(db, 'DELETE FROM day_notes WHERE project_id = ? AND date = ?', [projectId, date]);
    }

    return {
      id: existing?.id ?? 0,
      project_id: projectId,
      date,
      content: '',
      updated_at: new Date().toISOString(),
    };
  }

  if (existing) {
    runStatement(
      db,
      "UPDATE day_notes SET content = ?, updated_at = datetime('now') WHERE project_id = ? AND date = ?",
      [trimmed, projectId, date],
    );
  } else {
    runStatement(
      db,
      'INSERT INTO day_notes (project_id, date, content) VALUES (?, ?, ?)',
      [projectId, date, trimmed],
    );
  }

  const saved = getNote(userId, projectId, date);
  if (!saved) {
    throw new Error('Не удалось сохранить заметку');
  }

  return saved;
}
