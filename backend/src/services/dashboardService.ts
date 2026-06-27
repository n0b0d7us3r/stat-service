import { addDays, formatLocalDate, getTodayKey, parseLocalDate } from '../utils/date.js';
import { getAllGoalDays } from './goalsService.js';
import { getAllMarkedDays, getProjectStats } from './marksService.js';
import { getProjectsByUser, type ProjectType } from './projectsService.js';

export type DashboardWeekDayCellState = 'empty' | 'marked' | 'goal-success' | 'goal-missed' | 'goal-pending';

export interface DashboardWeekDayCell {
  date: string;
  state: DashboardWeekDayCellState;
}

export interface DashboardWeeklyProjectRow {
  id: number;
  name: string;
  project_type: ProjectType;
  days: DashboardWeekDayCell[];
  weekProgress: number;
  mobileWeekProgress: number;
}

export interface DashboardWeeklyMatrix {
  dates: string[];
  projects: DashboardWeeklyProjectRow[];
}

export interface DashboardMonthlyProjectRow {
  id: number;
  name: string;
  project_type: ProjectType;
  completed: number;
  total: number;
  progress: number;
}

export interface DashboardMonthlyStats {
  year: number;
  month: number;
  projects: DashboardMonthlyProjectRow[];
}

export interface DashboardStats {
  projectsCount: number;
  totalMarked: number;
  markedThisMonth: number;
  monthProgress: number;
  bestCurrentStreak: number;
  bestLongestStreak: number;
  projects: Array<{
    id: number;
    name: string;
    marked_count: number;
    markedThisMonth: number;
    currentStreak: number;
    longestStreak: number;
  }>;
  weeklyMatrix: DashboardWeeklyMatrix;
}

function getLast21DayKeys(todayKey: string): string[] {
  const today = parseLocalDate(todayKey);
  const dates: string[] = [];

  for (let offset = 20; offset >= 0; offset -= 1) {
    dates.push(formatLocalDate(addDays(today, -offset)));
  }

  return dates;
}

const MOBILE_MATRIX_DAYS = 14;

function getWeekCellState(
  projectType: ProjectType,
  date: string,
  todayKey: string,
  markedSet: Set<string>,
  goalSet: Set<string>,
): DashboardWeekDayCellState {
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

function getWeekProgress(
  projectType: ProjectType,
  dates: string[],
  todayKey: string,
  markedSet: Set<string>,
  goalSet: Set<string>,
): number {
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

function buildWeeklyMatrix(userId: number): DashboardWeeklyMatrix {
  const projects = getProjectsByUser(userId);
  const todayKey = getTodayKey();
  const dates = getLast21DayKeys(todayKey);
  const mobileDates = dates.slice(-MOBILE_MATRIX_DAYS);

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
      mobileWeekProgress: getWeekProgress(project.project_type, mobileDates, todayKey, markedSet, goalSet),
    };
  });

  return { dates, projects: rows };
}

export function getDashboardMonthlyStats(userId: number, year: number, month: number): DashboardMonthlyStats {
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

export function getDashboardStats(userId: number): DashboardStats {
  const projects = getProjectsByUser(userId);
  const now = new Date();
  const today = now.getDate();

  let totalMarked = 0;
  let markedThisMonth = 0;
  let bestCurrentStreak = 0;
  let bestLongestStreak = 0;

  const projectSummaries = projects.map((project) => {
    const stats = getProjectStats(userId, project.id);
    totalMarked += stats.totalMarked;
    markedThisMonth += stats.markedThisMonth;
    bestCurrentStreak = Math.max(bestCurrentStreak, stats.currentStreak);
    bestLongestStreak = Math.max(bestLongestStreak, stats.longestStreak);

    return {
      id: project.id,
      name: project.name,
      marked_count: stats.totalMarked,
      markedThisMonth: stats.markedThisMonth,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
    };
  });

  const monthProgress = today > 0 ? Math.min(Math.round((markedThisMonth / today) * 100), 100) : 0;

  return {
    projectsCount: projects.length,
    totalMarked,
    markedThisMonth,
    monthProgress,
    bestCurrentStreak,
    bestLongestStreak,
    projects: projectSummaries,
    weeklyMatrix: buildWeeklyMatrix(userId),
  };
}
