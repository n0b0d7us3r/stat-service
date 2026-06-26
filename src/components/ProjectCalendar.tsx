import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getNoteDatesForMonth } from '../db/notes';
import { getAllMarkedDays, getMarkedDaysForMonth, getTodayKey, markDay, unmarkDay } from '../db/markedDays';
import {
  formatLocalDate,
  getCalendarGrid,
  getMonthLabel,
  getMonthPrefix,
} from '../utils/date';
import '../styles/components/ProjectCalendar.css';

export interface ProjectCalendarHandle {
  applyMarks: () => void;
}

interface ProjectCalendarProps {
  projectId: number;
  editMode: boolean;
  isAdmin: boolean;
  isMutable: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onChange?: () => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function filterDatesForMonth(dates: Iterable<string>, year: number, month: number): string[] {
  const prefix = getMonthPrefix(year, month);
  return [...dates].filter((date) => date.startsWith(`${prefix}-`)).sort();
}

export const ProjectCalendar = forwardRef<ProjectCalendarHandle, ProjectCalendarProps>(function ProjectCalendar(
  {
    projectId,
    editMode,
    isAdmin,
    isMutable,
    selectedDate,
    onSelectDate,
    onChange,
  },
  ref,
) {
  const canRemoveMarks = isMutable && isAdmin;
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [savedMarkedDays, setSavedMarkedDays] = useState<string[]>(() => getMarkedDaysForMonth(projectId, year, month));
  const [noteDays, setNoteDays] = useState<string[]>(() => getNoteDatesForMonth(projectId, year, month));
  const [baselineMarks, setBaselineMarks] = useState<Set<string> | null>(null);
  const [draftMarks, setDraftMarks] = useState<Set<string> | null>(null);

  const monthPrefix = getMonthPrefix(year, month);
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const todayKey = getTodayKey();
  const noteSet = useMemo(() => new Set(noteDays), [noteDays]);

  const markedDays = useMemo(() => {
    if (editMode && draftMarks) {
      return filterDatesForMonth(draftMarks, year, month);
    }
    return savedMarkedDays;
  }, [editMode, draftMarks, savedMarkedDays, year, month]);

  const markedSet = useMemo(() => new Set(markedDays), [markedDays]);

  const reloadMonthFromDb = (nextYear: number, nextMonth: number) => {
    setSavedMarkedDays(getMarkedDaysForMonth(projectId, nextYear, nextMonth));
    setNoteDays(getNoteDatesForMonth(projectId, nextYear, nextMonth));
  };

  useEffect(() => {
    reloadMonthFromDb(year, month);
  }, [projectId, year, month]);

  useEffect(() => {
    if (editMode) {
      const initial = new Set(getAllMarkedDays(projectId));
      setBaselineMarks(initial);
      setDraftMarks(new Set(initial));
      return;
    }

    setBaselineMarks(null);
    setDraftMarks(null);
    reloadMonthFromDb(year, month);
  }, [editMode, projectId]);

  useImperativeHandle(ref, () => ({
    applyMarks: () => {
      if (!draftMarks || !baselineMarks) {
        return;
      }

      for (const date of draftMarks) {
        if (!baselineMarks.has(date)) {
          markDay(projectId, date);
        }
      }

      if (canRemoveMarks) {
        for (const date of baselineMarks) {
          if (!draftMarks.has(date)) {
            unmarkDay(projectId, date);
          }
        }
      }

      reloadMonthFromDb(year, month);
      onChange?.();
    },
  }), [baselineMarks, canRemoveMarks, draftMarks, onChange, projectId, year, month]);

  const goToPreviousMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
      return;
    }
    setMonth(month - 1);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
      return;
    }
    setMonth(month + 1);
  };

  const handleDayClick = (day: number) => {
    const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    onSelectDate(dateKey);

    if (!editMode || !draftMarks) {
      return;
    }

    const isMarked = draftMarks.has(dateKey);

    if (isMarked) {
      if (!canRemoveMarks) {
        return;
      }

      setDraftMarks((current) => {
        if (!current) return current;
        const next = new Set(current);
        next.delete(dateKey);
        return next;
      });
      return;
    }

    setDraftMarks((current) => {
      if (!current) return current;
      const next = new Set(current);
      next.add(dateKey);
      return next;
    });
  };

  const hint = editMode
    ? canRemoveMarks
      ? 'Отметки сохранятся после «Готово». «Отменить» сбросит изменения.'
      : 'Можно только добавлять отметки. Сохранение — после «Готово», отмена — «Отменить».'
    : `Клик по дню открывает заметку. Сегодня: ${formatLocalDate(today)}.`;

  return (
    <div className={`project-calendar ${editMode ? 'project-calendar-editing' : 'project-calendar-readonly'}`}>
      <div className="project-calendar-header">
        <button type="button" className="calendar-nav-btn" onClick={goToPreviousMonth} aria-label="Предыдущий месяц">
          <ChevronLeft size={18} />
        </button>
        <h2 className="project-calendar-title">{getMonthLabel(year, month)}</h2>
        <button type="button" className="calendar-nav-btn" onClick={goToNextMonth} aria-label="Следующий месяц">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="project-calendar-weekdays">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="project-calendar-weekday">{weekday}</span>
        ))}
      </div>

      <div className="project-calendar-grid">
        {grid.map((day, index) => {
          if (day === null) {
            return <span key={`empty-${index}`} className="calendar-day calendar-day-empty" />;
          }

          const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
          const isMarked = markedSet.has(dateKey);
          const hasNote = noteSet.has(dateKey);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const canMark = editMode && (!isMarked || canRemoveMarks);

          return (
            <button
              key={dateKey}
              type="button"
              className={[
                'calendar-day',
                isMarked ? 'calendar-day-marked' : '',
                hasNote ? 'calendar-day-has-note' : '',
                isToday ? 'calendar-day-today' : '',
                isSelected ? 'calendar-day-selected' : '',
                canMark ? 'calendar-day-interactive' : 'calendar-day-selectable',
              ].filter(Boolean).join(' ')}
              onClick={() => handleDayClick(day)}
            >
              <span className="calendar-day-number">{day}</span>
              {hasNote && <span className="calendar-day-note-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <p className="project-calendar-hint">{hint}</p>
    </div>
  );
});
