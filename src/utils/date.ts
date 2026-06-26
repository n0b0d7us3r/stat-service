export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMonthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getCalendarGrid(year: number, month: number): Array<number | null> {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const mondayBasedOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;

  const cells: Array<number | null> = Array.from({ length: mondayBasedOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function computeStreaks(markedDates: string[]): { currentStreak: number; longestStreak: number } {
  if (markedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sorted = [...new Set(markedDates)].sort();
  let longestStreak = 1;
  let run = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = parseLocalDate(sorted[index - 1]);
    const current = parseLocalDate(sorted[index]);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);

    if (diffDays === 1) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else if (diffDays > 1) {
      run = 1;
    }
  }

  const markedSet = new Set(sorted);
  let currentStreak = 0;
  let cursor = new Date();

  while (markedSet.has(formatLocalDate(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak, longestStreak };
}
