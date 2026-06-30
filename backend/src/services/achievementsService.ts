import { getUserDb } from '../db/userDb.js';
import { queryAll, queryExists, runStatement } from '../query.js';
import { addDays, computeStreaks, formatLocalDate, getTodayKey, parseLocalDate } from '../utils/date.js';
import { getAllGoalDays } from './goalsService.js';
import { getAllMarkedDays, getProjectStats } from './marksService.js';
import { getProjectsByUser } from './projectsService.js';

export type AchievementCriteriaType =
  | 'streak'
  | 'project_count'
  | 'month_progress'
  | 'note_count'
  | 'weekend_marked'
  | 'goal_streak'
  | 'global_streak';

export type ProjectType = 'calendar' | 'day';

export interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  criteria_type: AchievementCriteriaType;
  streak_days: number;
  project_type: ProjectType;
}

export interface UserAchievementView extends Achievement {
  earned: boolean;
  earned_at: string | null;
}

const DEFAULT_ACHIEVEMENTS: Array<{
  code: string;
  name: string;
  description: string;
  criteria_type: AchievementCriteriaType;
  threshold: number;
  project_type: ProjectType;
}> = [
  { code: 'first_project', name: 'Нужно с чего-то начинать', description: 'Создайте первый проект.', criteria_type: 'project_count', threshold: 1, project_type: 'calendar' },
  { code: 'week_streak', name: 'Недельный забег', description: 'Отметьте 7 дней подряд в любом проекте типа «Календарь».', criteria_type: 'streak', threshold: 7, project_type: 'calendar' },
  { code: 'ten_streak', name: 'Дальше - больше?', description: 'Отметьте 10 дней подряд в любом проекте типа «Календарь».', criteria_type: 'streak', threshold: 10, project_type: 'calendar' },
  { code: 'marathon', name: 'Марафонец', description: 'Отметьте 60 дней подряд в любом проекте типа «Календарь».', criteria_type: 'streak', threshold: 60, project_type: 'calendar' },
  { code: 'notebook', name: 'Запишу тебя в блокнотик', description: 'Напишите 5 заметок в проектах.', criteria_type: 'note_count', threshold: 5, project_type: 'calendar' },
  { code: 'weekend_warrior', name: 'Выходные для слабаков', description: 'Поставьте отметки в субботу и воскресенье одних выходных.', criteria_type: 'weekend_marked', threshold: 1, project_type: 'calendar' },
  { code: 'analyst', name: 'Аналитик', description: 'Создайте 5 проектов.', criteria_type: 'project_count', threshold: 5, project_type: 'calendar' },
  { code: 'librarian', name: 'Библиотекарь', description: 'Создайте 10 проектов.', criteria_type: 'project_count', threshold: 10, project_type: 'calendar' },
  { code: 'perfectionist', name: 'Перфецкионист', description: 'Достигните 100% прогресса месяца в любом проекте типа «Календарь».', criteria_type: 'month_progress', threshold: 100, project_type: 'calendar' },
  { code: 'goal_streak_10', name: 'Целеустремлённый', description: 'Выполните 10 целей подряд в одном проекте типа «Цели».', criteria_type: 'goal_streak', threshold: 10, project_type: 'calendar' },
  { code: 'stay_long', name: 'Ты со мной надолго?', description: 'Продолжайте ставить отметки в любом проекте в течение двух месяцев.', criteria_type: 'global_streak', threshold: 60, project_type: 'calendar' },
];

const CRITERIA_SORT_ORDER: Record<AchievementCriteriaType, number> = {
  project_count: 1,
  streak: 2,
  goal_streak: 3,
  global_streak: 4,
  note_count: 5,
  weekend_marked: 6,
  month_progress: 7,
};

function mapCriteriaType(value: string): AchievementCriteriaType {
  if (
    value === 'project_count'
    || value === 'month_progress'
    || value === 'note_count'
    || value === 'weekend_marked'
    || value === 'goal_streak'
    || value === 'global_streak'
  ) {
    return value;
  }
  return 'streak';
}

function mapAchievement(row: {
  id: number;
  code: string;
  name: string;
  description: string;
  streak_days: number;
  project_type: string;
  criteria_type: string;
}): Achievement {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    criteria_type: mapCriteriaType(row.criteria_type),
    streak_days: row.streak_days,
    project_type: row.project_type === 'day' ? 'day' : 'calendar',
  };
}

export function seedAchievements(userId: number): void {
  const db = getUserDb(userId);

  for (const item of DEFAULT_ACHIEVEMENTS) {
    if (queryExists(db, 'SELECT id FROM achievements WHERE code = ?', [item.code])) {
      runStatement(
        db,
        'UPDATE achievements SET name = ?, description = ?, streak_days = ?, criteria_type = ? WHERE code = ?',
        [item.name, item.description, item.threshold, item.criteria_type, item.code],
      );
      continue;
    }

    runStatement(
      db,
      `INSERT INTO achievements (code, name, description, streak_days, project_type, criteria_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.code, item.name, item.description, item.threshold, item.project_type, item.criteria_type],
    );
  }
}

export function getAllAchievements(userId: number): Achievement[] {
  const db = getUserDb(userId);
  const rows = queryAll<{
    id: number;
    code: string;
    name: string;
    description: string;
    streak_days: number;
    project_type: string;
    criteria_type: string;
  }>(
    db,
    `SELECT id, code, name, description, streak_days, project_type, criteria_type FROM achievements`,
  );

  return rows
    .map(mapAchievement)
    .sort((left, right) => {
      const typeOrder = CRITERIA_SORT_ORDER[left.criteria_type] - CRITERIA_SORT_ORDER[right.criteria_type];
      if (typeOrder !== 0) return typeOrder;
      return left.streak_days - right.streak_days;
    });
}

function getUserEarnedMap(userId: number): Map<number, string> {
  const rows = queryAll<{ achievement_id: number; earned_at: string }>(
    getUserDb(userId),
    'SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?',
    [userId],
  );

  return new Map(rows.map((row) => [row.achievement_id, row.earned_at]));
}

function getBestLongestStreakForType(userId: number, projectType: ProjectType): number {
  const projects = getProjectsByUser(userId).filter((project) => project.project_type === projectType);
  if (projects.length === 0) return 0;

  return projects.reduce((best, project) => {
    const { longestStreak } = getProjectStats(userId, project.id);
    return Math.max(best, longestStreak);
  }, 0);
}

function getUserNoteCount(userId: number): number {
  const rows = queryAll<{ total: number }>(
    getUserDb(userId),
    `
      SELECT COUNT(*) AS total
      FROM day_notes dn
      INNER JOIN projects p ON p.id = dn.project_id
      WHERE p.user_id = ? AND TRIM(dn.content) != ''
    `,
    [userId],
  );

  return rows[0]?.total ?? 0;
}

function getUserMarkedDates(userId: number): Set<string> {
  const rows = queryAll<{ date: string }>(
    getUserDb(userId),
    `
      SELECT m.date
      FROM marked_days m
      INNER JOIN projects p ON p.id = m.project_id
      WHERE p.user_id = ?
    `,
    [userId],
  );

  return new Set(rows.map((row) => row.date));
}

function hasWeekendPairMarked(userId: number): boolean {
  const markedDates = getUserMarkedDates(userId);

  for (const dateKey of markedDates) {
    const date = parseLocalDate(dateKey);
    if (date.getDay() !== 6) continue;

    const sundayKey = formatLocalDate(addDays(date, 1));
    if (markedDates.has(sundayKey)) return true;
  }

  return false;
}

function getBestMonthProgress(userId: number): number {
  const projects = getProjectsByUser(userId).filter((project) => project.project_type === 'calendar');
  if (projects.length === 0) return 0;

  return projects.reduce((best, project) => {
    const { monthProgress } = getProjectStats(userId, project.id);
    return Math.max(best, monthProgress);
  }, 0);
}

function getBestGoalCompletionStreak(userId: number): number {
  const todayKey = getTodayKey();
  const goalProjects = getProjectsByUser(userId).filter((project) => project.project_type === 'goals');
  let bestOverall = 0;

  for (const project of goalProjects) {
    const goalDays = getAllGoalDays(userId, project.id);
    const markedSet = new Set(getAllMarkedDays(userId, project.id));
    let current = 0;

    for (const date of goalDays) {
      if (date > todayKey) {
        continue;
      }

      if (markedSet.has(date)) {
        current += 1;
        bestOverall = Math.max(bestOverall, current);
      } else {
        current = 0;
      }
    }
  }

  return bestOverall;
}

function getGlobalLongestMarkStreak(userId: number): number {
  const markedDates = [...getUserMarkedDates(userId)];
  return computeStreaks(markedDates).longestStreak;
}

function isAchievementEarned(userId: number, achievement: Achievement): boolean {
  switch (achievement.criteria_type) {
    case 'project_count':
      return getProjectsByUser(userId).length >= achievement.streak_days;
    case 'month_progress':
      return getBestMonthProgress(userId) >= achievement.streak_days;
    case 'note_count':
      return getUserNoteCount(userId) >= achievement.streak_days;
    case 'weekend_marked':
      return hasWeekendPairMarked(userId);
    case 'goal_streak':
      return getBestGoalCompletionStreak(userId) >= achievement.streak_days;
    case 'global_streak':
      return getGlobalLongestMarkStreak(userId) >= achievement.streak_days;
    case 'streak':
    default:
      return getBestLongestStreakForType(userId, achievement.project_type) >= achievement.streak_days;
  }
}

function awardAchievement(userId: number, achievementId: number): void {
  const db = getUserDb(userId);

  if (queryExists(db, 'SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?', [userId, achievementId])) {
    return;
  }

  runStatement(db, 'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)', [userId, achievementId]);
}

export function syncUserAchievements(userId: number): Achievement[] {
  seedAchievements(userId);

  const earnedBefore = new Set(getUserEarnedMap(userId).keys());
  const achievements = getAllAchievements(userId);

  for (const achievement of achievements) {
    if (isAchievementEarned(userId, achievement)) {
      awardAchievement(userId, achievement.id);
    }
  }

  const earnedAfter = getUserEarnedMap(userId);

  return achievements.filter(
    (achievement) => earnedAfter.has(achievement.id) && !earnedBefore.has(achievement.id),
  );
}

export function getUserAchievements(userId: number): UserAchievementView[] {
  seedAchievements(userId);
  syncUserAchievements(userId);

  const earnedMap = getUserEarnedMap(userId);

  return getAllAchievements(userId).map((achievement) => ({
    ...achievement,
    earned: earnedMap.has(achievement.id),
    earned_at: earnedMap.get(achievement.id) ?? null,
  }));
}
