import { getUserDb } from '../db/userDb.js';
import { queryAll, queryExists, queryOne, runStatement } from '../query.js';
import { computeStreaks, getDaysInMonth, getMonthPrefix, getTodayKey, } from '../utils/date.js';
import { getProjectById } from './projectsService.js';
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
export function getProjectStats(userId, projectId) {
    const allDates = getAllMarkedDays(userId, projectId);
    const now = new Date();
    const monthPrefix = getMonthPrefix(now.getFullYear(), now.getMonth() + 1);
    const markedThisMonth = allDates.filter((date) => date.startsWith(monthPrefix)).length;
    const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1);
    const today = now.getDate();
    const monthProgress = today > 0 ? Math.round((markedThisMonth / today) * 100) : 0;
    const totalRow = queryAll(getUserDb(userId), 'SELECT COUNT(*) AS total FROM marked_days WHERE project_id = ?', [projectId]);
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
export function canRemoveMarks(userId, projectId, isAdmin) {
    return isProjectMutable(userId, projectId) && isAdmin;
}
