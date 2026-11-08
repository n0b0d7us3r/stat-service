import { getThreeCalendarWeekDayKeys, getTodayKey } from '../utils/date.js';
import { getAllGoalDays } from './goalsService.js';
import { getAllMarkedDays, getProjectStats } from './marksService.js';
import { getProjectsByUser } from './projectsService.js';
function getWeekCellState(projectType, date, todayKey, markedSet, goalSet) {
    if (projectType === 'goals') {
        if (!goalSet.has(date)) {
            return 'empty';
        }
        if (markedSet.has(date)) {
            return 'goal-success';
        }
        if (date < todayKey) {
            return 'goal-missed';
        }
        return 'goal-pending';
    }
    return markedSet.has(date) ? 'marked' : 'empty';
}
function getWeekProgress(projectType, dates, todayKey, markedSet, goalSet) {
    if (projectType === 'goals') {
        const goalDays = dates.filter((date) => goalSet.has(date));
        if (goalDays.length === 0) {
            return 0;
        }
        const dueGoalDays = goalDays.filter((date) => date <= todayKey);
        if (dueGoalDays.length === 0) {
            return 0;
        }
        const completed = dueGoalDays.filter((date) => markedSet.has(date)).length;
        return Math.round((completed / dueGoalDays.length) * 100);
    }
    const markedCount = dates.filter((date) => markedSet.has(date)).length;
    return Math.round((markedCount / dates.length) * 100);
}
function buildWeeklyMatrix(userId) {
    const projects = getProjectsByUser(userId);
    const todayKey = getTodayKey();
    const dates = getThreeCalendarWeekDayKeys(todayKey);
    const rows = projects.map((project) => {
        const markedSet = new Set(getAllMarkedDays(userId, project.id));
        const goalSet = new Set(getAllGoalDays(userId, project.id));
        const days = dates.map((date) => ({
            date,
            state: getWeekCellState(project.project_type, date, todayKey, markedSet, goalSet),
        }));
        return {
            id: project.id,
            name: project.name,
            project_type: project.project_type,
            days,
            weekProgress: getWeekProgress(project.project_type, dates, todayKey, markedSet, goalSet),
            mobileWeekProgress: getWeekProgress(project.project_type, dates, todayKey, markedSet, goalSet),
        };
    });
    return { dates, projects: rows };
}
function buildTodayGoals(userId) {
    const todayKey = getTodayKey();
    const goals = [];
    for (const project of getProjectsByUser(userId)) {
        const markedSet = new Set(getAllMarkedDays(userId, project.id));
        if (project.project_type === 'calendar') {
            goals.push({
                projectId: project.id,
                projectName: project.name,
                projectType: 'calendar',
                completed: markedSet.has(todayKey),
            });
            continue;
        }
        if (project.project_type === 'goals') {
            const goalDays = getAllGoalDays(userId, project.id);
            if (!goalDays.includes(todayKey)) {
                continue;
            }
            goals.push({
                projectId: project.id,
                projectName: project.name,
                projectType: 'goals',
                completed: markedSet.has(todayKey),
            });
        }
    }
    goals.sort((left, right) => left.projectName.localeCompare(right.projectName, 'ru'));
    return { date: todayKey, goals };
}
export function getDashboardMonthlyStats(userId, year, month) {
    const projects = getProjectsByUser(userId);
    const rows = projects.map((project) => {
        const stats = getProjectStats(userId, project.id, year, month);
        return {
            id: project.id,
            name: project.name,
            project_type: project.project_type,
            completed: stats.totalMarked,
            total: stats.daysInMonth,
            progress: stats.monthProgress,
        };
    });
    return { year, month, projects: rows };
}
export function getDashboardStats(userId) {
    const projects = getProjectsByUser(userId);
    let totalMarked = 0;
    let markedThisMonth = 0;
    let bestCurrentStreak = 0;
    let bestLongestStreak = 0;
    let bestCalendarMonthProgress = 0;
    const projectSummaries = projects.map((project) => {
        const stats = getProjectStats(userId, project.id);
        totalMarked += stats.totalMarked;
        markedThisMonth += stats.markedThisMonth;
        bestCurrentStreak = Math.max(bestCurrentStreak, stats.currentStreak);
        bestLongestStreak = Math.max(bestLongestStreak, stats.longestStreak);
        if (project.project_type === 'calendar') {
            bestCalendarMonthProgress = Math.max(bestCalendarMonthProgress, stats.monthProgress);
        }
        return {
            id: project.id,
            name: project.name,
            marked_count: stats.totalMarked,
            markedThisMonth: stats.markedThisMonth,
            currentStreak: stats.currentStreak,
            longestStreak: stats.longestStreak,
        };
    });
    return {
        projectsCount: projects.length,
        totalMarked,
        markedThisMonth,
        monthProgress: bestCalendarMonthProgress,
        bestCurrentStreak,
        bestLongestStreak,
        projects: projectSummaries,
        weeklyMatrix: buildWeeklyMatrix(userId),
        todayGoals: buildTodayGoals(userId),
    };
}
