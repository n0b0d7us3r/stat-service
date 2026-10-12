import type { Task } from '../types';
import { addDays, formatLocalDate, parseLocalDate } from './date';

export const TASK_ACTIVITY_WEEKS = 52;

export function completedTaskDateKey(completedAt: string): string | null {
  const datePart = completedAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

export function buildTaskCompletionCounts(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (!task.completed || !task.completed_at) {
      continue;
    }

    const dateKey = completedTaskDateKey(task.completed_at);
    if (!dateKey) {
      continue;
    }

    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }

  return counts;
}

export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  if (count === 2) {
    return 2;
  }
  if (count === 3) {
    return 3;
  }
  return 4;
}

export interface TaskActivityWeekColumn {
  days: Array<string | null>;
}

export interface TaskActivityGrid {
  columns: TaskActivityWeekColumn[];
  monthLabels: Array<{ weekIndex: number; label: string }>;
}

export function buildTaskActivityGrid(
  endDate: Date = new Date(),
  weeks: number = TASK_ACTIVITY_WEEKS,
): TaskActivityGrid {
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const spanDays = weeks * 7;
  const rangeStart = addDays(end, -(spanDays - 1));
  const rangeStartWeekday = rangeStart.getDay();
  const mondayOffset = rangeStartWeekday === 0 ? 6 : rangeStartWeekday - 1;
  const gridStart = addDays(rangeStart, -mondayOffset);

  const columns: TaskActivityWeekColumn[] = [];
  const monthLabels: Array<{ weekIndex: number; label: string }> = [];
  let cursor = gridStart;
  let previousMonth: number | null = null;

  for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
    const days: Array<string | null> = [];

    for (let row = 0; row < 7; row += 1) {
      if (cursor >= rangeStart && cursor <= end) {
        days.push(formatLocalDate(cursor));
      } else {
        days.push(null);
      }
      cursor = addDays(cursor, 1);
    }

    columns.push({ days });

    const anchor = columns[weekIndex].days.find((day) => day !== null);
    if (anchor) {
      const month = parseLocalDate(anchor).getMonth();
      if (previousMonth === null || month !== previousMonth) {
        monthLabels.push({
          weekIndex,
          label: parseLocalDate(anchor).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''),
        });
        previousMonth = month;
      }
    }
  }

  return { columns, monthLabels };
}

export function formatActivityDayLabel(dateKey: string, count: number): string {
  const dateLabel = parseLocalDate(dateKey).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (count <= 0) {
    return `0 задач завершено · ${dateLabel}`;
  }

  const taskWord = count === 1 ? 'задача' : count >= 2 && count <= 4 ? 'задачи' : 'задач';
  return `${count} ${taskWord} завершено · ${dateLabel}`;
}
