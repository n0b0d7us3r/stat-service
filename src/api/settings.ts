import type { UserSettings } from '../types';
import { apiFetch } from './client';

export async function getUserSettings(): Promise<UserSettings> {
  const { settings } = await apiFetch<{ settings: UserSettings }>('/settings');
  return settings;
}

export async function updateUserSettings(input: Partial<UserSettings>): Promise<UserSettings> {
  const { settings } = await apiFetch<{ settings: UserSettings }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return settings;
}
