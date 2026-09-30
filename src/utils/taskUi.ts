import type { Task, TaskPriority, TaskSortMode } from '../types';

export const TASK_PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 1, label: 'Низкий' },
  { value: 2, label: 'Обычный' },
  { value: 3, label: 'Высокий' },
  { value: 4, label: 'Срочный' },
];

export const TAG_COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: 'rgb(147, 0, 0)', label: 'Красный' },
  { value: '#f97316', label: 'Оранжевый' },
  { value: '#6b7280', label: 'Серый' },
  { value: 'rgba(134, 245, 29, 0.87)', label: 'Зелёный' },
  { value: '#3b82f6', label: 'Синий' },
  { value: '#8b5cf6', label: 'Фиолетовый' },
];

export function priorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITIES.find((item) => item.value === priority)?.label ?? 'Обычный';
}

export function formatTagName(name: string): string {
  return name.toLocaleUpperCase('ru');
}

function tagChannels(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }

  const rgba = hex.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i);
  if (!rgba) {
    return null;
  }

  const channels = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])] as [number, number, number];
  if (channels.some((channel) => channel > 255)) {
    return null;
  }

  return channels;
}

export function tagForeground(color: string): string {
  const channels = tagChannels(color);
  if (!channels) {
    return '#ffffff';
  }

  const [red, green, blue] = channels;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#18181d' : '#ffffff';
}

export function tagBorderColor(color: string): string {
  const channels = tagChannels(color);
  if (!channels) {
    return '#000000';
  }

  const darkened = channels.map((channel) => Math.max(0, Math.round(channel * 0.72)));
  return `#${darkened.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function tagChipStyle(color: string): {
  backgroundColor: string;
  color: string;
  border: string;
} {
  return {
    backgroundColor: color,
    color: tagForeground(color),
    border: `2px solid ${tagBorderColor(color)}`,
  };
}

function taskDueDate(task: Task): string | null {
  const value = task.due_date?.trim();
  return value ? value : null;
}

export function compareTasks(a: Task, b: Task, sort: TaskSortMode): number {
  if (sort === 'created') {
    const dueA = taskDueDate(a);
    const dueB = taskDueDate(b);
    if (dueA !== dueB) {
      if (!dueA) return 1;
      if (!dueB) return -1;
      return dueA < dueB ? -1 : 1;
    }
  } else if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }

  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }

  return b.id - a.id;
}
