import type { DashboardStats } from '../types';
import { apiFetch } from './client';

export async function getDashboardStats(_userId: number): Promise<DashboardStats> {
  const { stats } = await apiFetch<{ stats: DashboardStats }>('/dashboard');
  return stats;
}
