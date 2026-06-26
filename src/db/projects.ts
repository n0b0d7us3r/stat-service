import { flushDatabase, getDatabase, persistDatabase } from './database';
import { getLastInsertId, queryAll, queryOne, runStatement } from './query';
import { DbError, type Project, type ProjectType } from './types';

function mapProject(row: {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  project_type: string;
  is_mutable: number;
  created_at: string;
  marked_count: number;
}): Project {
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

export function getProjectsByUser(userId: number): Project[] {
  const db = getDatabase();
  const rows = queryAll<{
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    project_type: string;
    is_mutable: number;
    created_at: string;
    marked_count: number;
  }>(
    db,
    `${projectSelect}
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
    [userId],
  );

  return rows.map(mapProject);
}

export function getProjectById(userId: number, projectId: number): Project | null {
  const db = getDatabase();
  const row = queryOne<{
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    project_type: string;
    is_mutable: number;
    created_at: string;
    marked_count: number;
  }>(
    db,
    `${projectSelect}
      WHERE p.id = ? AND p.user_id = ?
      GROUP BY p.id
    `,
    [projectId, userId],
  );

  return row ? mapProject(row) : null;
}

export function createProject(
  userId: number,
  name: string,
  description = '',
  projectType: ProjectType = 'calendar',
  isMutable = false,
): Project {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new DbError('Название проекта обязательно');
  }

  if (projectType !== 'calendar') {
    throw new DbError('Тип «День» пока недоступен');
  }

  const db = getDatabase();
  runStatement(
    db,
    'INSERT INTO projects (user_id, name, description, project_type, is_mutable) VALUES (?, ?, ?, ?, ?)',
    [userId, trimmedName, description.trim() || null, projectType, isMutable ? 1 : 0],
  );

  persistDatabase();

  const projectId = getLastInsertId(db);
  const project = getProjectById(userId, projectId);

  if (!project) {
    throw new DbError('Не удалось создать проект');
  }

  return project;
}

export async function deleteProject(userId: number, projectId: number): Promise<void> {
  const db = getDatabase();
  const project = getProjectById(userId, projectId);

  if (!project) {
    throw new DbError('Проект не найден');
  }

  runStatement(db, 'DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
  persistDatabase();
  await flushDatabase();
}
