import { getProjectStats } from './marksService.js';
import { getProjectsByUser } from './projectsService.js';

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
  };
}
