import { getUserDb } from '../db/userDb.js';
import { queryAll, queryExists, queryOne, runStatement } from '../query.js';
import { computeStreaks, computeStreaksInMonth, getDaysInMonth, getMonthPrefix, getTodayKey, } from '../utils/date.js';
import { getProjectById } from './projectsService.js';
import { getAllGoalDays } from './goalsService.js';
export function getMarkedDaysForMonth(userId, projectId, year, month) {
    const db = getUserDb(userId);
    const prefix = getMonthPrefix(year, month);
    const rows = queryAll(db, 'SELECT date FROM marked_days WHERE project_id = ? AND date LIKE ? ORDER BY date', [projectId, `${prefix}-%`]);
    return rows.map((row) => row.date);
}
export function getAllMarkedDays(userId, projectId) {
    const db = getUserDb(userId);
    const rows = queryAll(db, 'SELECT date FROM marked_days WHERE project_id = ? ORDER BY date', [projectId]);
    return rows.map((row) => row.date);
}
function isProjectMutable(userId, projectId) {
    const row = queryOne(getUserDb(userId), 'SELECT is_mutable FROM projects WHERE id = ?', [projectId]);
    return row?.is_mutable === 1;
}
export function syncMarkedDays(userId, projectId, add, remove, isAdmin) {
    const project = getProjectById(userId, projectId);
    if (!project) {
        throw new Error('Проект не найден');
    }
    const db = getUserDb(userId);
    const canRemove = project.is_mutable;
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
export function getProjectStats(userId, projectId, year, month) {
    const project = getProjectById(userId, projectId);
    if (!project) {
        return emptyProjectStats();
    }
    const allMarkedDates = getAllMarkedDays(userId, projectId);
    if (year !== undefined && month !== undefined) {
        if (project.project_type === 'goals') {
            return getGoalsProjectStatsForMonth(allMarkedDates, getAllGoalDays(userId, projectId), year, month);
        }
        return getCalendarProjectStatsForMonth(allMarkedDates, year, month);
    }
    if (project.project_type === 'goals') {
        return getGoalsProjectStats(allMarkedDates, getAllGoalDays(userId, projectId));
    }
    return getCalendarProjectStats(userId, projectId, allMarkedDates);
}
function emptyProjectStats() {
    return {
        totalMarked: 0,
        markedThisMonth: 0,
        daysInMonth: 0,
        monthProgress: 0,
        currentStreak: 0,
        longestStreak: 0,
    };
}
function getCalendarProjectStatsForMonth(allDates, year, month) {
    const monthPrefix = getMonthPrefix(year, month);
    const todayKey = getTodayKey();
    const markedInMonth = allDates.filter((date) => date.startsWith(`${monthPrefix}-`));
    const daysInMonth = getDaysInMonth(year, month);
    const monthProgress = todayKey < `${monthPrefix}-01` || daysInMonth === 0
        ? 0
        : Math.round((markedInMonth.length / daysInMonth) * 100);
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
function getGoalsProjectStatsForMonth(allMarkedDates, allGoalDates, year, month) {
    const monthPrefix = getMonthPrefix(year, month);
    const todayKey = getTodayKey();
    const markedSet = new Set(allMarkedDates);
    const goalDaysInMonth = allGoalDates.filter((date) => date.startsWith(`${monthPrefix}-`));
    if (goalDaysInMonth.length === 0) {
        return emptyProjectStats();
    }
    const completedInMonth = goalDaysInMonth.filter((date) => markedSet.has(date));
    const monthProgress = goalDaysInMonth.length > 0
        ? Math.round((completedInMonth.length / goalDaysInMonth.length) * 100)
        : 0;
    const completedDates = allGoalDates.filter((date) => markedSet.has(date));
    const { currentStreak, longestStreak } = computeStreaksInMonth(completedDates, year, month, todayKey);
    return {
        totalMarked: completedInMonth.length,
        markedThisMonth: completedInMonth.length,
        daysInMonth: goalDaysInMonth.length,
        monthProgress: Math.min(monthProgress, 100),
        currentStreak,
        longestStreak,
    };
}
function getCalendarProjectStats(userId, projectId, allDates) {
    const todayKey = getTodayKey();
    const year = Number(todayKey.slice(0, 4));
    const month = Number(todayKey.slice(5, 7));
    const monthStats = getCalendarProjectStatsForMonth(allDates, year, month);
    const totalRow = queryAll(getUserDb(userId), 'SELECT COUNT(*) AS total FROM marked_days WHERE project_id = ?', [projectId]);
    const { currentStreak, longestStreak } = computeStreaks(allDates);
    return {
        totalMarked: totalRow[0]?.total ?? 0,
        markedThisMonth: monthStats.markedThisMonth,
        daysInMonth: monthStats.daysInMonth,
        monthProgress: monthStats.monthProgress,
        currentStreak,
        longestStreak,
    };
}
function getGoalsProjectStats(allMarkedDates, allGoalDates) {
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
    const goalDaysThisMonth = allGoalDates.filter((date) => date.startsWith(monthPrefix));
    const completedThisMonth = goalDaysThisMonth.filter((date) => markedSet.has(date));
    const monthProgress = goalDaysThisMonth.length > 0
        ? Math.round((completedThisMonth.length / goalDaysThisMonth.length) * 100)
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
export function canRemoveMarks(userId, projectId) {
    return isProjectMutable(userId, projectId);
}
