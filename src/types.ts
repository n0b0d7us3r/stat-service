export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export type ProjectType = 'calendar' | 'day' | 'goals';

export type AchievementCriteriaType =
  | 'streak'
  | 'project_count'
  | 'month_progress'
  | 'note_count'
  | 'weekend_marked';

export interface Project {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  project_type: ProjectType;
  is_mutable: boolean;
  created_at: string;
  marked_count: number;
}

export interface DayNote {
  id: number;
  project_id: number;
  date: string;
  content: string;
  updated_at: string;
}

export interface ProjectStats {
  totalMarked: number;
  markedThisMonth: number;
  daysInMonth: number;
  monthProgress: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DashboardProjectSummary {
  id: number;
  name: string;
  marked_count: number;
  markedThisMonth: number;
  currentStreak: number;
  longestStreak: number;
}

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
  projects: DashboardProjectSummary[];
  weeklyMatrix: DashboardWeeklyMatrix;
}

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

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiDataError';
  }
}
