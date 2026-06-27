import { getUserDb } from '../db/userDb.js';
import { queryAll, queryExists, queryOne, runStatement } from '../query.js';
import {
  computeStreaks,
  computeStreaksInMonth,
  getDaysInMonth,
  getMonthPrefix,
  getTodayKey,
} from '../utils/date.js';
import { getProjectById } from './projectsService.js';
import { getAllGoalDays } from './goalsService.js';

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

export function getProjectStats(
  userId: number,
  projectId: number,
  year?: number,
  month?: number,
): ProjectStats {
  const project = getProjectById(userId, projectId);
  if (!project) {
    return emptyProjectStats();
  }

  const allMarkedDates = getAllMarkedDays(userId, projectId);

  if (year !== undefined && month !== undefined) {
    if (project.project_type === 'goals') {
      return getGoalsProjectStatsForMonth(
        allMarkedDates,
        getAllGoalDays(userId, projectId),
        year,
        month,
      );
    }

    return getCalendarProjectStatsForMonth(allMarkedDates, year, month);
  }

  if (project.project_type === 'goals') {
    return getGoalsProjectStats(allMarkedDates, getAllGoalDays(userId, projectId));
  }

  return getCalendarProjectStats(userId, projectId, allMarkedDates);
}

function emptyProjectStats(): ProjectStats {
  return {
    totalMarked: 0,
    markedThisMonth: 0,
    daysInMonth: 0,
    monthProgress: 0,
    currentStreak: 0,
    longestStreak: 0,
  };
}

function getCalendarProjectStatsForMonth(
  allDates: string[],
  year: number,
  month: number,
): ProjectStats {
  const monthPrefix = getMonthPrefix(year, month);
  const todayKey = getTodayKey();
  const markedInMonth = allDates.filter((date) => date.startsWith(`${monthPrefix}-`));
  const daysInMonth = getDaysInMonth(year, month);
  const monthEnd = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;

  let monthProgress = 0;
  if (todayKey < `${monthPrefix}-01`) {
    monthProgress = 0;
  } else if (todayKey.startsWith(monthPrefix)) {
    const today = parseInt(todayKey.split('-')[2], 10);
    monthProgress = today > 0 ? Math.round((markedInMonth.length / today) * 100) : 0;
  } else if (todayKey > monthEnd) {
    monthProgress = daysInMonth > 0 ? Math.round((markedInMonth.length / daysInMonth) * 100) : 0;
  }

  const { currentStreak, longestStreak } = computeStreaksInMonth(allDates, year, month, todayKey);

  return {
    totalMarked: markedInMonth.length,
    markedThisMonth: markedInMonth.length,
    daysInMonth,
    monthProgress: Math.min(monthProgress, 100),
    currentStreak,
    longestStreak,
  };
}

function getGoalsProjectStatsForMonth(
  allMarkedDates: string[],
  allGoalDates: string[],
  year: number,
  month: number,
): ProjectStats {
  const monthPrefix = getMonthPrefix(year, month);
  const todayKey = getTodayKey();
  const markedSet = new Set(allMarkedDates);
  const goalDaysInMonth = allGoalDates.filter((date) => date.startsWith(`${monthPrefix}-`));

  if (goalDaysInMonth.length === 0) {
    return emptyProjectStats();
  }

  const completedInMonth = goalDaysInMonth.filter((date) => markedSet.has(date));
  const goalDaysDueInMonth = goalDaysInMonth.filter((date) => date <= todayKey);
  const completedDueInMonth = goalDaysDueInMonth.filter((date) => markedSet.has(date));
  const monthProgress = goalDaysDueInMonth.length > 0
    ? Math.round((completedDueInMonth.length / goalDaysDueInMonth.length) * 100)
    : 0;

  const completedDates = allGoalDates.filter((date) => markedSet.has(date));
  const { currentStreak, longestStreak } = computeStreaksInMonth(
    completedDates,
    year,
    month,
    todayKey,
  );

  return {
    totalMarked: completedInMonth.length,
    markedThisMonth: completedInMonth.length,
    daysInMonth: goalDaysInMonth.length,
    monthProgress: Math.min(monthProgress, 100),
    currentStreak,
    longestStreak,
  };
}

function getCalendarProjectStats(
  userId: number,
  projectId: number,
  allDates: string[],
): ProjectStats {
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

function getGoalsProjectStats(allMarkedDates: string[], allGoalDates: string[]): ProjectStats {
  if (allGoalDates.length === 0) {
    return {
      totalMarked: 0,
      markedThisMonth: 0,
      daysInMonth: 0,
      monthProgress: 0,
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  const markedSet = new Set(allMarkedDates);
  const completedDates = allGoalDates.filter((date) => markedSet.has(date));

  const now = new Date();
  const monthPrefix = getMonthPrefix(now.getFullYear(), now.getMonth() + 1);
  const todayKey = getTodayKey();
  const goalDaysThisMonth = allGoalDates.filter((date) => date.startsWith(monthPrefix));
  const completedThisMonth = goalDaysThisMonth.filter((date) => markedSet.has(date));
  const goalDaysDueThisMonth = goalDaysThisMonth.filter((date) => date <= todayKey);
  const completedDueThisMonth = goalDaysDueThisMonth.filter((date) => markedSet.has(date));
  const monthProgress = goalDaysDueThisMonth.length > 0
    ? Math.round((completedDueThisMonth.length / goalDaysDueThisMonth.length) * 100)
    : 0;

  const { currentStreak, longestStreak } = computeStreaks(completedDates);

  return {
    totalMarked: completedDates.length,
    markedThisMonth: completedThisMonth.length,
    daysInMonth: goalDaysThisMonth.length,
    monthProgress: Math.min(monthProgress, 100),
    currentStreak,
    longestStreak,
  };
}

export { getTodayKey };

export function canRemoveMarks(userId: number, projectId: number, isAdmin: boolean): boolean {
  return isProjectMutable(userId, projectId) && isAdmin;
}
