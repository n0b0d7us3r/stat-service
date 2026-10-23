export type AccentName = 'night' | 'orange';

export function resolveAccent(value: string | undefined): AccentName {
  return value?.trim().toLowerCase() === 'orange' ? 'orange' : 'night';
}

/** Акцент интерфейса: night по умолчанию, orange через VITE_ACCENT=orange. */
export const accent = resolveAccent(import.meta.env.VITE_ACCENT);
