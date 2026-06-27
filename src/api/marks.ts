import type { Achievement, ProjectStats } from '../types';
import { apiFetch } from './client';

export async function getMarkedDaysForMonth(
  projectId: number,
  year: number,
  month: number,
): Promise<string[]> {
  const { dates } = await apiFetch<{ dates: string[] }>(
    `/projects/${projectId}/marks?year=${year}&month=${month}`,
  );
  return dates;
}

export async function getAllMarkedDays(projectId: number): Promise<string[]> {
  const { dates } = await apiFetch<{ dates: string[] }>(
    `/projects/${projectId}/marks?scope=all`,
  );
  return dates;
}

export async function syncMarkedDays(
  projectId: number,
  add: string[],
  remove: string[],
): Promise<Achievement[]> {
  const { newlyEarned } = await apiFetch<{ ok: true; newlyEarned: Achievement[] }>(
    `/projects/${projectId}/marks/sync`,
    {
      method: 'POST',
      body: JSON.stringify({ add, remove }),
    },
  );
  return newlyEarned;
}

export async function getProjectStats(
  projectId: number,
  year?: number,
  month?: number,
): Promise<ProjectStats> {
  const query = year !== undefined && month !== undefined
    ? `?year=${year}&month=${month}`
    : '';
  const { stats } = await apiFetch<{ stats: ProjectStats }>(`/projects/${projectId}/stats${query}`);
  return stats;
}

export async function getTodayKey(): Promise<string> {
  const { today } = await apiFetch<{ today: string }>('/meta/today');
  return today;
}
