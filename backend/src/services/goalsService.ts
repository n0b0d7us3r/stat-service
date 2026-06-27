import { getUserDb } from '../db/userDb.js';
import { queryAll, queryExists, runStatement } from '../query.js';
import { getMonthPrefix } from '../utils/date.js';
import { getProjectById } from './projectsService.js';

export function getGoalDaysForMonth(userId: number, projectId: number, year: number, month: number): string[] {
  const db = getUserDb(userId);
  const prefix = getMonthPrefix(year, month);

  const rows = queryAll<{ date: string }>(
    db,
    'SELECT date FROM goal_days WHERE project_id = ? AND date LIKE ? ORDER BY date',
    [projectId, `${prefix}-%`],
  );

  return rows.map((row) => row.date);
}

export function getAllGoalDays(userId: number, projectId: number): string[] {
  const db = getUserDb(userId);
  const rows = queryAll<{ date: string }>(
    db,
    'SELECT date FROM goal_days WHERE project_id = ? ORDER BY date',
    [projectId],
  );

  return rows.map((row) => row.date);
}

export function syncGoalDays(
  userId: number,
  projectId: number,
  add: string[],
  remove: string[],
  isAdmin: boolean,
): void {
  const project = getProjectById(userId, projectId);
  if (!project) {
    throw new Error('Проект не найден');
  }

  const db = getUserDb(userId);
  const canRemove = project.is_mutable && isAdmin;

  for (const date of add) {
    if (!queryExists(db, 'SELECT id FROM goal_days WHERE project_id = ? AND date = ?', [projectId, date])) {
      runStatement(db, 'INSERT INTO goal_days (project_id, date) VALUES (?, ?)', [projectId, date]);
    }
  }

  if (canRemove) {
    for (const date of remove) {
      runStatement(db, 'DELETE FROM goal_days WHERE project_id = ? AND date = ?', [projectId, date]);
    }
  }
}
