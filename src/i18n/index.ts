import en from './en.json';
import ru from './ru.json';

export type Locale = 'en' | 'ru';

export function resolveLocale(value: string | undefined): Locale {
  return value?.trim().toLowerCase() === 'ru' ? 'ru' : 'en';
}

export const locale: Locale = resolveLocale(import.meta.env.VITE_LOCALE);

export const dateLocaleTag = locale === 'ru' ? 'ru-RU' : 'en-US';

type Messages = Omit<typeof en, 'achievements'>;
export type MessageKey = keyof Messages;

const catalog: Record<Locale, Messages> = { en, ru };

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text = catalog[locale][key] ?? en[key];
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

const apiMessages: Record<string, MessageKey> = {
  'Email и пароль обязательны': 'loginFailed',
  'Пароль должен содержать минимум 6 символов': 'passwordTooShort',
  'Пользователь с таким email уже существует': 'registerFailed',
  'Не удалось создать пользователя': 'registerFailed',
  'Неверный email или пароль': 'loginInvalid',
  'Требуется авторизация': 'checkingSession',
  'Сессия недействительна': 'checkingSession',
  'Внутренняя ошибка сервера': 'connectionFailed',
  'Название проекта обязательно': 'createProjectFailed',
  'Тип «День» пока недоступен': 'comingSoonTitle',
  'Не удалось создать проект': 'createProjectFailed',
  'Проект не найден': 'projectNotFound',
  'Укажите название задачи': 'saveTaskFailed',
  'Название задачи слишком длинное': 'saveTaskFailed',
  'Некорректное описание задачи': 'saveTaskFailed',
  'Описание задачи слишком длинное': 'saveTaskFailed',
  'Некорректная дата выполнения': 'saveTaskFailed',
  'Некорректный приоритет': 'saveTaskFailed',
  'Некорректный список тегов': 'saveTaskFailed',
  'Один из тегов не найден': 'saveTaskFailed',
  'Не удалось создать задачу': 'saveTaskFailed',
  'Задача не найдена': 'deleteTaskFailed',
  'Некорректный идентификатор задачи': 'deleteTaskFailed',
  'Укажите название тега': 'tagNameRequired',
  'Название тега слишком длинное': 'tagNameRequired',
  'Тег — одно слово без пробелов': 'tagNameRequired',
  'Выберите цвет тега': 'createTagFailed',
  'Такой тег уже есть': 'createTagFailed',
  'Не удалось создать тег': 'createTagFailed',
  'Тег не найден': 'deleteTagFailed',
  'Некорректный идентификатор тега': 'deleteTagFailed',
  'Поддерживаются только PNG, JPEG, GIF и WebP': 'imageUploadFailed',
  'Пустой файл изображения': 'imageUploadFailed',
  'Изображение слишком большое (максимум 5 МБ)': 'imageUploadFailed',
  'Некорректные данные изображения': 'imageUploadFailed',
  'year и month обязательны': 'connectionFailed',
  'Некорректные year и month': 'connectionFailed',
};

export function localizeApiMessage(message: string): string {
  if (locale !== 'en') return message;
  const key = apiMessages[message];
  return key ? t(key) : message;
}

type AchievementCode = keyof typeof en.achievements;

function achievementCopy(code: string): { name: string; description: string } | undefined {
  const table = locale === 'ru' ? ru.achievements : en.achievements;
  return table[code as AchievementCode];
}

export function achievementName(code: string, fallback: string): string {
  return achievementCopy(code)?.name ?? fallback;
}

export function achievementDescription(code: string, fallback: string): string {
  return achievementCopy(code)?.description ?? fallback;
}

export function completedTasksLabel(count: number, dateLabel: string): string {
  if (count === 0) return t('noCompletedOnDay', { date: dateLabel });
  if (count === 1) return t('tasksCompletedOnDayOne', { date: dateLabel });
  return t('tasksCompletedOnDay', { count, date: dateLabel });
}

export const weekdayLabels = [
  t('weekdayMon'),
  t('weekdayTue'),
  t('weekdayWed'),
  t('weekdayThu'),
  t('weekdayFri'),
  t('weekdaySat'),
  t('weekdaySun'),
] as const;

export const activityWeekdayLabels = [
  t('weekdayMon'),
  '',
  t('weekdayWed'),
  '',
  t('weekdayFri'),
  '',
  '',
];

export function projectTypeLabel(type: 'calendar' | 'day' | 'goals'): string {
  if (type === 'day') return t('typeDay');
  if (type === 'goals') return t('typeGoals');
  return t('typeCalendar');
}
