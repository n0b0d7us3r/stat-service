import { flushDatabase, getDatabase, persistDatabase } from './database';
import { queryAll, queryExists, queryOne, runStatement } from './query';
import { type ProjectStats } from './types';
import {
  computeStreaks,
  formatLocalDate,
  getDaysInMonth,
  getMonthPrefix,
} from '../utils/date';

export function getMarkedDaysForMonth(projectId: number, year: number, month: number): string[] {
  const db = getDatabase();
  const prefix = getMonthPrefix(year, month);

  const rows = queryAll<{ date: string }>(
    db,
    'SELECT date FROM marked_days WHERE project_id = ? AND date LIKE ? ORDER BY date',
    [projectId, `${prefix}-%`],
  );

  return rows.map((row) => row.date);
}

export function getAllMarkedDays(projectId: number): string[] {
  const db = getDatabase();
  const rows = queryAll<{ date: string }>(
    db,
    'SELECT date FROM marked_days WHERE project_id = ? ORDER BY date',
    [projectId],
  );

  return rows.map((row) => row.date);
}

export function isDayMarked(projectId: number, date: string): boolean {
  const db = getDatabase();
  return queryExists(db, 'SELECT id FROM marked_days WHERE project_id = ? AND date = ?', [projectId, date]);
}

export function markDay(projectId: number, date: string): boolean {
  const db = getDatabase();

  if (queryExists(db, 'SELECT id FROM marked_days WHERE project_id = ? AND date = ?', [projectId, date])) {
    return false;
  }

  runStatement(db, 'INSERT INTO marked_days (project_id, date) VALUES (?, ?)', [projectId, date]);
  persistDatabase();
  return true;
}

function isProjectMutable(projectId: number): boolean {
  const db = getDatabase();
  const row = queryOne<{ is_mutable: number }>(
    db,
    'SELECT is_mutable FROM projects WHERE id = ?',
    [projectId],
  );

  return row?.is_mutable === 1;
}

export function unmarkDay(projectId: number, date: string): boolean {
  const db = getDatabase();

  if (!isProjectMutable(projectId)) {
    return false;
  }

  if (!queryExists(db, 'SELECT id FROM marked_days WHERE project_id = ? AND date = ?', [projectId, date])) {
    return false;
  }

  runStatement(db, 'DELETE FROM marked_days WHERE project_id = ? AND date = ?', [projectId, date]);
  persistDatabase();
  return true;
}

export async function flushMarkedDays(): Promise<void> {
  await flushDatabase();
}

export function getProjectStats(projectId: number): ProjectStats {
  const db = getDatabase();
  const allDates = getAllMarkedDays(projectId);
  const now = new Date();
  const monthPrefix = getMonthPrefix(now.getFullYear(), now.getMonth() + 1);
  const markedThisMonth = allDates.filter((date) => date.startsWith(monthPrefix)).length;
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1);
  const today = now.getDate();
  const monthProgress = today > 0 ? Math.round((markedThisMonth / today) * 100) : 0;

  const totalRow = queryAll<{ total: number }>(
    db,
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

export function getTodayKey(): string {
  return formatLocalDate(new Date());
}
