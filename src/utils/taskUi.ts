import type { Task, TaskPriority, TaskSortMode } from '../types';

export const TASK_PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 1, label: 'Низкий' },
  { value: 2, label: 'Обычный' },
  { value: 3, label: 'Высокий' },
  { value: 4, label: 'Срочный' },
];

export const TAG_COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: '#ef4444', label: 'Красный' },
  { value: '#f97316', label: 'Оранжевый' },
  { value: '#eab308', label: 'Жёлтый' },
  { value: '#22c55e', label: 'Зелёный' },
  { value: '#14b8a6', label: 'Бирюзовый' },
  { value: '#3b82f6', label: 'Синий' },
  { value: '#8b5cf6', label: 'Фиолетовый' },
  { value: '#ec4899', label: 'Розовый' },
];

export function priorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITIES.find((item) => item.value === priority)?.label ?? 'Обычный';
}

export function tagForeground(color: string): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '#ffffff';
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#18181d' : '#ffffff';
}

export function compareTasks(a: Task, b: Task, sort: TaskSortMode): number {
  if (sort === 'priority' && a.priority !== b.priority) {
    return b.priority - a.priority;
  }

  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }

  return b.id - a.id;
}
