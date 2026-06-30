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

export type NotesSortMode = 'date' | 'project';

export interface DayNoteListItem extends DayNote {
  project_name: string;
}

export interface NotesListResult {
  notes: DayNoteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sort: NotesSortMode;
}

const NOTES_PAGE_SIZE = 25;

export function listUserNotes(
  userId: number,
  options: { sort?: NotesSortMode; page?: number; limit?: number } = {},
): NotesListResult {
  const sort = options.sort === 'project' ? 'project' : 'date';
  const limit = Math.min(Math.max(options.limit ?? NOTES_PAGE_SIZE, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const db = getUserDb(userId);
  const whereClause = "WHERE p.user_id = ? AND TRIM(dn.content) != ''";

  const countRow = queryOne<{ total: number }>(
    db,
    `
      SELECT COUNT(*) AS total
      FROM day_notes dn
      INNER JOIN projects p ON p.id = dn.project_id
      ${whereClause}
    `,
    [userId],
  );
  const total = countRow?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  if (safePage !== page) {
    return listUserNotes(userId, { sort, page: safePage, limit });
  }

  const orderClause = sort === 'project'
    ? 'ORDER BY p.name COLLATE NOCASE ASC, dn.date ASC, dn.id ASC'
    : 'ORDER BY dn.date DESC, dn.id DESC';

  const rows = queryAll<DayNoteListItem>(
    db,
    `
      SELECT
        dn.id,
        dn.project_id,
        dn.date,
        dn.content,
        dn.updated_at,
        p.name AS project_name
      FROM day_notes dn
      INNER JOIN projects p ON p.id = dn.project_id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `,
    [userId, limit, offset],
  );

  return {
    notes: rows,
    total,
    page: safePage,
    limit,
    totalPages,
    sort,
  };
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
