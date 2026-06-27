import { apiFetch } from './client';
import type { Achievement } from '../types';

export async function getGoalDaysForMonth(
  projectId: number,
  year: number,
  month: number,
): Promise<string[]> {
  const { dates } = await apiFetch<{ dates: string[] }>(
    `/projects/${projectId}/goals?year=${year}&month=${month}`,
  );
  return dates;
}

export async function getAllGoalDays(projectId: number): Promise<string[]> {
  const { dates } = await apiFetch<{ dates: string[] }>(
    `/projects/${projectId}/goals?scope=all`,
  );
  return dates;
}

export async function syncGoalDays(
  projectId: number,
  add: string[],
  remove: string[],
): Promise<Achievement[]> {
  const { newlyEarned } = await apiFetch<{ ok: true; newlyEarned: Achievement[] }>(
    `/projects/${projectId}/goals/sync`,
    {
      method: 'POST',
      body: JSON.stringify({ add, remove }),
    },
  );
  return newlyEarned;
}
