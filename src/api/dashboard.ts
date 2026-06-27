import type { DashboardMonthlyStats, DashboardStats } from '../types';
import { apiFetch } from './client';

export async function getDashboardStats(_userId: number): Promise<DashboardStats> {
  const { stats } = await apiFetch<{ stats: DashboardStats }>('/dashboard');
  return stats;
}

export async function getDashboardMonthlyStats(
  _userId: number,
  year: number,
  month: number,
): Promise<DashboardMonthlyStats> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const { stats } = await apiFetch<{ stats: DashboardMonthlyStats }>(`/dashboard/month?${params}`);
  return stats;
}
