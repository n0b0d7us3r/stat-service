function parseEnvFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/** Включена ли публичная регистрация (/register и ссылка на странице входа). */
export const isPublicRegisterAllowed = parseEnvFlag(import.meta.env.VITE_ALLOW_PUBLIC_REGISTER);
