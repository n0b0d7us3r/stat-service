import { getUserDb } from '../db/userDb.js';
import { queryAll, queryOne, runStatement } from '../query.js';
import { DbError } from './projectsService.js';
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 50_000;
const MAX_TAG_NAME_LENGTH = 32;
const MAX_TAGS_PER_TASK = 1;
const MAX_FOLDER_NAME_LENGTH = 40;
const TASK_COLUMNS = 'id, title, description, priority, completed, archived, created_at, completed_at, due_date, folder_id';
function normalizeTitle(raw) {
    const title = raw.trim();
    if (!title) {
        throw new DbError('Укажите название задачи');
    }
    if (title.length > MAX_TITLE_LENGTH) {
        throw new DbError('Название задачи слишком длинное');
    }
    return title;
}
function normalizeDescription(value) {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value !== 'string') {
        throw new DbError('Некорректное описание задачи');
    }
    const description = value.trim();
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        throw new DbError('Описание задачи слишком длинное');
    }
    return description;
}
function normalizeTagName(raw) {
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
    return name.toLocaleUpperCase('ru');
}
function normalizeColor(raw) {
    const color = raw.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(color)) {
        return color;
    }
    const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
    if (rgb) {
        const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
        if (channels.some((channel) => channel > 255)) {
            throw new DbError('Выберите цвет тега');
        }
        return `rgb(${channels.join(', ')})`;
    }
    const rgba = color.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/);
    if (!rgba) {
        throw new DbError('Выберите цвет тега');
    }
    const channels = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const alpha = Number(rgba[4]);
    if (channels.some((channel) => channel > 255) || alpha > 1) {
        throw new DbError('Выберите цвет тега');
    }
    return `rgba(${channels.join(', ')}, ${rgba[4]})`;
}
function normalizeDueDate(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new DbError('Некорректная дата выполнения');
    }
    const date = value.trim();
    if (!date) {
        return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new DbError('Некорректная дата выполнения');
    }
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
        throw new DbError('Некорректная дата выполнения');
    }
    return date;
}
function normalizePriority(value) {
    const priority = Number(value ?? 2);
    if (priority !== 1 && priority !== 2 && priority !== 3 && priority !== 4) {
        throw new DbError('Некорректный приоритет');
    }
    return priority;
}
function normalizeTagIds(value) {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new DbError('Некорректный список тегов');
    }
    const ids = [];
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
        return [ids[ids.length - 1]];
    }
    return ids;
}
function readPriority(value) {
    if (value === 1 || value === 2 || value === 3 || value === 4) {
        return value;
    }
    return 2;
}
function assertTagsExist(db, tagIds) {
    if (tagIds.length === 0) {
        return;
    }
    const placeholders = tagIds.map(() => '?').join(', ');
    const rows = queryAll(db, `SELECT id FROM tags WHERE id IN (${placeholders})`, tagIds);
    if (rows.length !== tagIds.length) {
        throw new DbError('Один из тегов не найден');
    }
}
function tagsForTaskIds(db, taskIds) {
    const map = new Map();
    if (taskIds.length === 0) {
        return map;
    }
    const placeholders = taskIds.map(() => '?').join(', ');
    const rows = queryAll(db, `
      SELECT tt.task_id, t.id, t.name, t.color, t.created_at
      FROM task_tags tt
      INNER JOIN tags t ON t.id = tt.tag_id
      WHERE tt.task_id IN (${placeholders})
      ORDER BY t.name COLLATE NOCASE ASC
    `, taskIds);
    for (const row of rows) {
        const list = map.get(row.task_id) ?? [];
        list.push({
            id: row.id,
            name: row.name.toLocaleUpperCase('ru'),
            color: row.color,
            created_at: row.created_at,
        });
        map.set(row.task_id, list);
    }
    return map;
}
function mapTask(row, tags) {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        priority: readPriority(row.priority),
        completed: row.completed === 1,
        archived: row.archived === 1,
        created_at: row.created_at,
        completed_at: row.completed_at,
        due_date: row.due_date,
        folder_id: row.folder_id,
        tags: tags.slice(0, 1),
    };
}
function readTask(db, taskId) {
    const row = queryOne(db, `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`, [taskId]);
    if (!row) {
        return null;
    }
    return mapTask(row, tagsForTaskIds(db, [taskId]).get(taskId) ?? []);
}
function insertTaskTags(db, taskId, tagIds) {
    const insert = db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) {
        insert.run(taskId, tagId);
    }
}
export function listTaskBoard(userId) {
    const db = getUserDb(userId);
    const tags = queryAll(db, 'SELECT id, name, color, created_at FROM tags ORDER BY name COLLATE NOCASE ASC');
    const folders = queryAll(db, 'SELECT id, name, created_at FROM folders ORDER BY name COLLATE NOCASE ASC');
    const rows = queryAll(db, `SELECT ${TASK_COLUMNS} FROM tasks`);
    const byTask = tagsForTaskIds(db, rows.map((row) => row.id));
    return {
        tags: tags.map((tag) => ({ ...tag, name: tag.name.toLocaleUpperCase('ru') })),
        folders,
        tasks: rows.map((row) => mapTask(row, byTask.get(row.id) ?? [])),
    };
}
export function createTag(userId, nameRaw, colorRaw) {
    const db = getUserDb(userId);
    const name = normalizeTagName(nameRaw);
    const color = normalizeColor(colorRaw);
    const existingTags = queryAll(db, 'SELECT name FROM tags');
    const duplicate = existingTags.some((tag) => tag.name.localeCompare(name, 'ru', { sensitivity: 'accent' }) === 0);
    if (duplicate) {
        throw new DbError('Такой тег уже есть');
    }
    let tagId = 0;
    try {
        const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color);
        tagId = Number(result.lastInsertRowid);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE')) {
            throw new DbError('Такой тег уже есть');
        }
        throw error;
    }
    const tag = queryOne(db, 'SELECT id, name, color, created_at FROM tags WHERE id = ?', [tagId]);
    if (!tag) {
        throw new DbError('Не удалось создать тег');
    }
    return tag;
}
export function deleteTag(userId, tagId) {
    const db = getUserDb(userId);
    const existing = queryOne(db, 'SELECT id FROM tags WHERE id = ?', [tagId]);
    if (!existing) {
        return false;
    }
    db.transaction(() => {
        runStatement(db, 'DELETE FROM task_tags WHERE tag_id = ?', [tagId]);
        runStatement(db, 'DELETE FROM tags WHERE id = ?', [tagId]);
    })();
    return true;
}
export function createTask(userId, input) {
    const db = getUserDb(userId);
    const title = normalizeTitle(input.title);
    const description = normalizeDescription(input.description);
    const priority = normalizePriority(input.priority);
    const dueDate = normalizeDueDate(input.dueDate);
    const tagIds = normalizeTagIds(input.tagIds);
    assertTagsExist(db, tagIds);
    const folderId = input.folderId == null ? null : normalizeFolderId(db, input.folderId);
    const taskId = db.transaction(() => {
        const result = db.prepare('INSERT INTO tasks (title, description, priority, due_date, folder_id) VALUES (?, ?, ?, ?, ?)').run(title, description, priority, dueDate, folderId);
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
export function updateTask(userId, taskId, input) {
    const db = getUserDb(userId);
    const existing = readTask(db, taskId);
    if (!existing) {
        return null;
    }
    const title = input.title === undefined ? existing.title : normalizeTitle(input.title);
    const description = input.description === undefined ? existing.description : normalizeDescription(input.description);
    const priority = input.priority === undefined ? existing.priority : normalizePriority(input.priority);
    const dueDate = input.dueDate === undefined ? existing.due_date : normalizeDueDate(input.dueDate);
    const completed = input.completed === undefined ? existing.completed : Boolean(input.completed);
    const archived = input.archived === undefined ? existing.archived : Boolean(input.archived);
    const tagIds = input.tagIds === undefined ? null : normalizeTagIds(input.tagIds);
    if (tagIds !== null) {
        assertTagsExist(db, tagIds);
    }
    const folderId = input.folderId === undefined ? existing.folder_id : normalizeFolderId(db, input.folderId);
    const completedFlag = completed ? 1 : 0;
    const archivedFlag = archived ? 1 : 0;
    db.transaction(() => {
        runStatement(db, `
        UPDATE tasks
        SET
          title = ?,
          description = ?,
          priority = ?,
          due_date = ?,
          completed = ?,
          archived = ?,
          folder_id = ?,
          completed_at = CASE
            WHEN ? = 0 THEN NULL
            WHEN completed = 0 THEN datetime('now')
            ELSE completed_at
          END
        WHERE id = ?
      `, [title, description, priority, dueDate, completedFlag, archivedFlag, folderId, completedFlag, taskId]);
        if (tagIds !== null) {
            runStatement(db, 'DELETE FROM task_tags WHERE task_id = ?', [taskId]);
            insertTaskTags(db, taskId, tagIds);
        }
    })();
    return readTask(db, taskId);
}
function normalizeFolderName(name) {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
        throw new DbError('Укажите название папки');
    }
    if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
        throw new DbError('Название папки слишком длинное');
    }
    return trimmed;
}
function normalizeFolderId(db, folderId) {
    if (folderId === null) {
        return null;
    }
    if (!Number.isInteger(folderId) || folderId <= 0) {
        throw new DbError('Папка не найдена');
    }
    const folder = queryOne(db, 'SELECT id FROM folders WHERE id = ?', [folderId]);
    if (!folder) {
        throw new DbError('Папка не найдена');
    }
    return folderId;
}
export function createFolder(userId, nameRaw) {
    const db = getUserDb(userId);
    const name = normalizeFolderName(nameRaw);
    const result = db.prepare('INSERT INTO folders (name) VALUES (?)').run(name);
    const folder = queryOne(db, 'SELECT id, name, created_at FROM folders WHERE id = ?', [Number(result.lastInsertRowid)]);
    if (!folder) {
        throw new DbError('Не удалось создать папку');
    }
    return folder;
}
export function deleteFolder(userId, folderId) {
    const db = getUserDb(userId);
    const existing = queryOne(db, 'SELECT id FROM folders WHERE id = ?', [folderId]);
    if (!existing) {
        return false;
    }
    db.transaction(() => {
        runStatement(db, 'UPDATE tasks SET folder_id = NULL WHERE folder_id = ?', [folderId]);
        runStatement(db, 'DELETE FROM folders WHERE id = ?', [folderId]);
    })();
    return true;
}
export function deleteTask(userId, taskId) {
    const db = getUserDb(userId);
    const existing = queryOne(db, 'SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
        return false;
    }
    db.transaction(() => {
        runStatement(db, 'DELETE FROM task_tags WHERE task_id = ?', [taskId]);
        runStatement(db, 'DELETE FROM tasks WHERE id = ?', [taskId]);
    })();
    return true;
}
