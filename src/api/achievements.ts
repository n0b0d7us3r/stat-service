import type { Achievement, UserAchievementView } from '../types';
import { apiFetch } from './client';

export async function getUserAchievements(_userId: number): Promise<UserAchievementView[]> {
  const { achievements } = await apiFetch<{ achievements: UserAchievementView[] }>('/achievements');
  return achievements;
}

export async function syncUserAchievements(_userId: number): Promise<Achievement[]> {
  const { newlyEarned } = await apiFetch<{ newlyEarned: Achievement[] }>('/achievements/sync', {
    method: 'POST',
  });
  return newlyEarned;
}
