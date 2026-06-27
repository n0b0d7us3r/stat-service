import { getUserDb } from '../db/userDb.js';
import { queryAll, queryExists, queryOne, runStatement } from '../query.js';
import {
  computeStreaks,
  getDaysInMonth,
  getMonthPrefix,
  getTodayKey,
} from '../utils/date.js';
import { getProjectById } from './projectsService.js';

export interface ProjectStats {
  totalMarked: number;
  markedThisMonth: number;
  daysInMonth: number;
  monthProgress: number;
  currentStreak: number;
  longestStreak: number;
}

export function getMarkedDaysForMonth(userId: number, projectId: number, year: number, month: number): string[] {
  const db = getUserDb(userId);
  const prefix = getMonthPrefix(year, month);

  const rows = queryAll<{ date: string }>(
    db,
    'SELECT date FROM marked_days WHERE project_id = ? AND date LIKE ? ORDER BY date',
    [projectId, `${prefix}-%`],
  );

  return rows.map((row) => row.date);
}

export function getAllMarkedDays(userId: number, projectId: number): string[] {
  const db = getUserDb(userId);
  const rows = queryAll<{ date: string }>(
    db,
    'SELECT date FROM marked_days WHERE project_id = ? ORDER BY date',
    [projectId],
  );

  return rows.map((row) => row.date);
}

function isProjectMutable(userId: number, projectId: number): boolean {
  const row = queryOne<{ is_mutable: number }>(
    getUserDb(userId),
    'SELECT is_mutable FROM projects WHERE id = ?',
    [projectId],
  );

  return row?.is_mutable === 1;
}

export function syncMarkedDays(
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
    if (!queryExists(db, 'SELECT id FROM marked_days WHERE project_id = ? AND date = ?', [projectId, date])) {
      runStatement(db, 'INSERT INTO marked_days (project_id, date) VALUES (?, ?)', [projectId, date]);
    }
  }

  if (canRemove) {
    for (const date of remove) {
      runStatement(db, 'DELETE FROM marked_days WHERE project_id = ? AND date = ?', [projectId, date]);
    }
  }
}

export function getProjectStats(userId: number, projectId: number): ProjectStats {
  const allDates = getAllMarkedDays(userId, projectId);
  const now = new Date();
  const monthPrefix = getMonthPrefix(now.getFullYear(), now.getMonth() + 1);
  const markedThisMonth = allDates.filter((date) => date.startsWith(monthPrefix)).length;
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1);
  const today = now.getDate();
  const monthProgress = today > 0 ? Math.round((markedThisMonth / today) * 100) : 0;

  const totalRow = queryAll<{ total: number }>(
    getUserDb(userId),
    'SELECT COUNT(*) AS total FROM marked_days WHERE project_id = ?',
    [projectId],
  );

  const { currentStreak, longestStreak } = computeStreaks(allDates);

  return {
    totalMarked: totalRow[0]?.total ?? 0,
    markedThisMonth,
    daysInMonth,
    monthProgress: Math.min(monthProgress, 100),
    currentStreak,
    longestStreak,
  };
}

export { getTodayKey };

export function canRemoveMarks(userId: number, projectId: number, isAdmin: boolean): boolean {
  return isProjectMutable(userId, projectId) && isAdmin;
}
