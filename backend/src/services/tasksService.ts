import type Database from 'better-sqlite3';
import { getUserDb } from '../db/userDb.js';
import { queryAll, queryOne, runStatement } from '../query.js';
import { DbError } from './projectsService.js';

export type TaskPriority = 1 | 2 | 3 | 4;

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  priority: TaskPriority;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  tags: Tag[];
}

const MAX_TITLE_LENGTH = 200;
const MAX_TAG_NAME_LENGTH = 32;
const MAX_TAGS_PER_TASK = 10;

interface TaskRow {
  id: number;
  title: string;
  priority: number;
  completed: number;
  created_at: string;
  completed_at: string | null;
}

function normalizeTitle(raw: string): string {
  const title = raw.trim();
  if (!title) {
    throw new DbError('Укажите название задачи');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new DbError('Название задачи слишком длинное');
  }
  return title;
}

function normalizeTagName(raw: string): string {
  const name = raw.trim().replace(/^#+/u, '');
  if (!name) {
    throw new DbError('Укажите название тега');
  }
  if (name.length > MAX_TAG_NAME_LENGTH) {
    throw new DbError('Название тега слишком длинное');
  }
  if (/[\s#]/u.test(name)) {
    throw new DbError('Тег — одно слово без пробелов');
  }
  return name;
}

function normalizeColor(raw: string): string {
  const color = raw.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    throw new DbError('Выберите цвет тега');
  }
  return color;
}

function normalizePriority(value: unknown): TaskPriority {
  const priority = Number(value ?? 2);
  if (priority !== 1 && priority !== 2 && priority !== 3 && priority !== 4) {
    throw new DbError('Некорректный приоритет');
  }
  return priority;
}

function normalizeTagIds(value: unknown): number[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new DbError('Некорректный список тегов');
  }

  const ids: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) {
      throw new DbError('Некорректный список тегов');
    }
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  if (ids.length > MAX_TAGS_PER_TASK) {
    throw new DbError('У задачи не больше 10 тегов');
  }

  return ids;
}

function readPriority(value: number): TaskPriority {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return 2;
}

function assertTagsExist(db: Database.Database, tagIds: number[]): void {
  if (tagIds.length === 0) {
    return;
  }

  const placeholders = tagIds.map(() => '?').join(', ');
  const rows = queryAll<{ id: number }>(
    db,
    `SELECT id FROM tags WHERE id IN (${placeholders})`,
    tagIds,
  );

  if (rows.length !== tagIds.length) {
    throw new DbError('Один из тегов не найден');
  }
}

function tagsForTaskIds(db: Database.Database, taskIds: number[]): Map<number, Tag[]> {
  const map = new Map<number, Tag[]>();
  if (taskIds.length === 0) {
    return map;
  }

  const placeholders = taskIds.map(() => '?').join(', ');
  const rows = queryAll<Tag & { task_id: number }>(
    db,
    `
      SELECT tt.task_id, t.id, t.name, t.color, t.created_at
      FROM task_tags tt
      INNER JOIN tags t ON t.id = tt.tag_id
      WHERE tt.task_id IN (${placeholders})
      ORDER BY t.name COLLATE NOCASE ASC
    `,
    taskIds,
  );

  for (const row of rows) {
    const list = map.get(row.task_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      color: row.color,
      created_at: row.created_at,
    });
    map.set(row.task_id, list);
  }

  return map;
}

function mapTask(row: TaskRow, tags: Tag[]): Task {
  return {
    id: row.id,
    title: row.title,
    priority: readPriority(row.priority),
    completed: row.completed === 1,
    created_at: row.created_at,
    completed_at: row.completed_at,
    tags,
  };
}

function readTask(db: Database.Database, taskId: number): Task | null {
  const row = queryOne<TaskRow>(
    db,
    'SELECT id, title, priority, completed, created_at, completed_at FROM tasks WHERE id = ?',
    [taskId],
  );
  if (!row) {
    return null;
  }

  return mapTask(row, tagsForTaskIds(db, [taskId]).get(taskId) ?? []);
}

function insertTaskTags(db: Database.Database, taskId: number, tagIds: number[]): void {
  const insert = db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)');
  for (const tagId of tagIds) {
    insert.run(taskId, tagId);
  }
}

export function listTaskBoard(userId: number): { tasks: Task[]; tags: Tag[] } {
  const db = getUserDb(userId);
  const tags = queryAll<Tag>(
    db,
    'SELECT id, name, color, created_at FROM tags ORDER BY name COLLATE NOCASE ASC',
  );
  const rows = queryAll<TaskRow>(
    db,
    'SELECT id, title, priority, completed, created_at, completed_at FROM tasks',
  );
  const byTask = tagsForTaskIds(db, rows.map((row) => row.id));

  return {
    tags,
    tasks: rows.map((row) => mapTask(row, byTask.get(row.id) ?? [])),
  };
}

export function createTag(userId: number, nameRaw: string, colorRaw: string): Tag {
  const db = getUserDb(userId);
  const name = normalizeTagName(nameRaw);
  const color = normalizeColor(colorRaw);
  const existingTags = queryAll<{ name: string }>(db, 'SELECT name FROM tags');
  const duplicate = existingTags.some(
    (tag) => tag.name.localeCompare(name, 'ru', { sensitivity: 'accent' }) === 0,
  );
  if (duplicate) {
    throw new DbError('Такой тег уже есть');
  }

  let tagId = 0;
  try {
    const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color);
    tagId = Number(result.lastInsertRowid);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new DbError('Такой тег уже есть');
    }
    throw error;
  }

  const tag = queryOne<Tag>(db, 'SELECT id, name, color, created_at FROM tags WHERE id = ?', [tagId]);
  if (!tag) {
    throw new DbError('Не удалось создать тег');
  }

  return tag;
}

export function deleteTag(userId: number, tagId: number): boolean {
  const db = getUserDb(userId);
  const existing = queryOne<{ id: number }>(db, 'SELECT id FROM tags WHERE id = ?', [tagId]);
  if (!existing) {
    return false;
  }

  db.transaction(() => {
    runStatement(db, 'DELETE FROM task_tags WHERE tag_id = ?', [tagId]);
    runStatement(db, 'DELETE FROM tags WHERE id = ?', [tagId]);
  })();

  return true;
}

export function createTask(
  userId: number,
  input: { title: string; priority?: unknown; tagIds?: unknown },
): Task {
  const db = getUserDb(userId);
  const title = normalizeTitle(input.title);
  const priority = normalizePriority(input.priority);
  const tagIds = normalizeTagIds(input.tagIds);
  assertTagsExist(db, tagIds);

  const taskId = db.transaction(() => {
    const result = db.prepare('INSERT INTO tasks (title, priority) VALUES (?, ?)').run(title, priority);
    const id = Number(result.lastInsertRowid);
    insertTaskTags(db, id, tagIds);
    return id;
  })();

  const task = readTask(db, taskId);
  if (!task) {
    throw new DbError('Не удалось создать задачу');
  }

  return task;
}

export function updateTask(
  userId: number,
  taskId: number,
  input: { title?: string; priority?: unknown; completed?: boolean; tagIds?: unknown },
): Task | null {
  const db = getUserDb(userId);
  const existing = readTask(db, taskId);
  if (!existing) {
    return null;
  }

  const title = input.title === undefined ? existing.title : normalizeTitle(input.title);
  const priority = input.priority === undefined ? existing.priority : normalizePriority(input.priority);
  const completed = input.completed === undefined ? existing.completed : Boolean(input.completed);
  const tagIds = input.tagIds === undefined ? null : normalizeTagIds(input.tagIds);
  if (tagIds !== null) {
    assertTagsExist(db, tagIds);
  }

  const completedFlag = completed ? 1 : 0;

  db.transaction(() => {
    runStatement(
      db,
      `
        UPDATE tasks
        SET
          title = ?,
          priority = ?,
          completed = ?,
          completed_at = CASE
            WHEN ? = 0 THEN NULL
            WHEN completed = 0 THEN datetime('now')
            ELSE completed_at
          END
        WHERE id = ?
      `,
      [title, priority, completedFlag, completedFlag, taskId],
    );

    if (tagIds !== null) {
      runStatement(db, 'DELETE FROM task_tags WHERE task_id = ?', [taskId]);
      insertTaskTags(db, taskId, tagIds);
    }
  })();

  return readTask(db, taskId);
}

export function deleteTask(userId: number, taskId: number): boolean {
  const db = getUserDb(userId);
  const existing = queryOne<{ id: number }>(db, 'SELECT id FROM tasks WHERE id = ?', [taskId]);
  if (!existing) {
    return false;
  }

  db.transaction(() => {
    runStatement(db, 'DELETE FROM task_tags WHERE task_id = ?', [taskId]);
    runStatement(db, 'DELETE FROM tasks WHERE id = ?', [taskId]);
  })();

  return true;
}
