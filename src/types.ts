export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export type ProjectType = 'calendar' | 'day';

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

export interface DashboardStats {
  projectsCount: number;
  totalMarked: number;
  markedThisMonth: number;
  monthProgress: number;
  bestCurrentStreak: number;
  bestLongestStreak: number;
  projects: DashboardProjectSummary[];
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
