import { t } from '../i18n';

/** Статический заголовок мобильной шапки по маршруту (кроме /tasks и динамических страниц). */
export function mobileHeaderTitleForPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return t('dashboardTitle');
  if (pathname === '/tasks') return null;
  if (pathname === '/finance') return t('financeTitle');
  if (pathname === '/projects') return t('projectsTitle');
  if (pathname.startsWith('/projects/')) return null;
  if (pathname === '/notes') return t('notesTitle');
  if (pathname === '/achievements') return t('achievementsTitle');
  if (pathname === '/settings') return t('settingsTitle');
  return null;
}
