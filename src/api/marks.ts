import type { ProjectStats } from '../types';
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
): Promise<void> {
  await apiFetch(`/projects/${projectId}/marks/sync`, {
    method: 'POST',
    body: JSON.stringify({ add, remove }),
  });
}

export async function getProjectStats(projectId: number): Promise<ProjectStats> {
  const { stats } = await apiFetch<{ stats: ProjectStats }>(`/projects/${projectId}/stats`);
  return stats;
}

export async function getTodayKey(): Promise<string> {
  const { today } = await apiFetch<{ today: string }>('/meta/today');
  return today;
}
