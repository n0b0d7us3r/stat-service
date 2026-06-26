import { flushDatabase, getDatabase, persistDatabase } from './database';
import { queryAll, queryOne, runStatement } from './query';
import type { DayNote } from './types';
import { getMonthPrefix } from '../utils/date';

export function getNote(projectId: number, date: string): DayNote | null {
  const db = getDatabase();
  const row = queryOne<{
    id: number;
    project_id: number;
    date: string;
    content: string;
    updated_at: string;
  }>(
    db,
    'SELECT id, project_id, date, content, updated_at FROM day_notes WHERE project_id = ? AND date = ?',
    [projectId, date],
  );

  return row ?? null;
}

export function getNoteDatesForMonth(projectId: number, year: number, month: number): string[] {
  const db = getDatabase();
  const prefix = getMonthPrefix(year, month);

  const rows = queryAll<{ date: string }>(
    db,
    `
      SELECT date FROM day_notes
      WHERE project_id = ? AND date LIKE ? AND TRIM(content) != ''
      ORDER BY date
    `,
    [projectId, `${prefix}-%`],
  );

  return rows.map((row) => row.date);
}

export function saveNote(projectId: number, date: string, content: string): DayNote {
  const db = getDatabase();
  const trimmed = content.trim();
  const existing = getNote(projectId, date);

  if (!trimmed) {
    if (existing) {
      runStatement(db, 'DELETE FROM day_notes WHERE project_id = ? AND date = ?', [projectId, date]);
    }
    persistDatabase();
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

  persistDatabase();

  const saved = getNote(projectId, date);
  if (!saved) {
    throw new Error('Не удалось сохранить заметку');
  }

  return saved;
}

export async function flushNotes(): Promise<void> {
  await flushDatabase();
}
