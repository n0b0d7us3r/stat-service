import { ApiDataError, AuthError } from '../types';

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/** URL для GET ресурсов API — тот же принцип, что у apiFetch (path без дублирования /api). */
export function resolveApiResourceUrl(resourcePath: string): string {
  if (
    resourcePath.startsWith('http://')
    || resourcePath.startsWith('https://')
    || resourcePath.startsWith('blob:')
    || resourcePath.startsWith('data:')
  ) {
    return resourcePath;
  }

  let path = resourcePath.trim();
  if (path.startsWith('/api/')) {
    path = path.slice(4);
  } else if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const base = API_BASE.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function toAuthError(error: unknown): never {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 400) {
      throw new AuthError(error.message);
    }
    throw new ApiDataError(error.message);
  }

  throw error;
}
