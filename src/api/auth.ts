import { apiFetch, toAuthError } from './client';
import { AuthError, type User } from '../types';

export { AuthError };

export async function registerUser(email: string, password: string): Promise<User> {
  try {
    const { user } = await apiFetch<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return user;
  } catch (error) {
    toAuthError(error);
  }
}

export async function loginUser(email: string, password: string, remember = false): Promise<void> {
  try {
    await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember }),
    });
  } catch (error) {
    toAuthError(error);
  }
}

export async function logoutUser(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { user } = await apiFetch<{ user: User }>('/auth/me');
    return user;
  } catch {
    return null;
  }
}

export async function verifyUserPassword(_userId: number, password: string): Promise<boolean> {
  const { valid } = await apiFetch<{ valid: boolean }>('/auth/verify-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return valid;
}
