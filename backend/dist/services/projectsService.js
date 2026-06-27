import { getUserDb } from '../db/userDb.js';
import { getLastInsertId, queryAll, queryOne, runStatement } from '../query.js';
export class DbError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DbError';
    }
}
function mapProject(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description,
        project_type: row.project_type === 'day' ? 'day' : 'calendar',
        is_mutable: row.is_mutable === 1,
        created_at: row.created_at,
        marked_count: row.marked_count,
    };
}
const projectSelect = `
  SELECT
    p.id,
    p.user_id,
    p.name,
    p.description,
    p.project_type,
    p.is_mutable,
    p.created_at,
    COUNT(m.id) AS marked_count
  FROM projects p
  LEFT JOIN marked_days m ON m.project_id = p.id
`;
function dbForUser(userId) {
    return getUserDb(userId);
}
export function getProjectsByUser(userId) {
    const db = dbForUser(userId);
    const rows = queryAll(db, `${projectSelect}
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [userId]);
    return rows.map(mapProject);
}
export function getProjectById(userId, projectId) {
    const db = dbForUser(userId);
    const row = queryOne(db, `${projectSelect}
      WHERE p.id = ? AND p.user_id = ?
      GROUP BY p.id
    `, [projectId, userId]);
    return row ? mapProject(row) : null;
}
export function createProject(userId, name, description = '', projectType = 'calendar', isMutable = false) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new DbError('Название проекта обязательно');
    }
    if (projectType !== 'calendar') {
        throw new DbError('Тип «День» пока недоступен');
    }
    const db = dbForUser(userId);
    runStatement(db, 'INSERT INTO projects (user_id, name, description, project_type, is_mutable) VALUES (?, ?, ?, ?, ?)', [userId, trimmedName, description.trim() || null, projectType, isMutable ? 1 : 0]);
    const projectId = getLastInsertId(db);
    const project = getProjectById(userId, projectId);
    if (!project) {
        throw new DbError('Не удалось создать проект');
    }
    return project;
}
export function deleteProject(userId, projectId) {
    const project = getProjectById(userId, projectId);
    if (!project) {
        throw new DbError('Проект не найден');
    }
    runStatement(dbForUser(userId), 'DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
}
