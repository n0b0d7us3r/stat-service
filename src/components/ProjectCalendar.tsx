import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getNoteDatesForMonth } from '../api/notes';
import { getAllMarkedDays, getMarkedDaysForMonth, getTodayKey, syncMarkedDays } from '../api/marks';
import {
  formatLocalDate,
  getCalendarGrid,
  getMonthLabel,
  getMonthPrefix,
} from '../utils/date';
import '../styles/components/ProjectCalendar.css';

export interface ProjectCalendarHandle {
  applyMarks: () => Promise<void>;
}

interface ProjectCalendarProps {
  projectId: number;
  editMode: boolean;
  isAdmin: boolean;
  isMutable: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
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
  const [savedMarkedDays, setSavedMarkedDays] = useState<string[]>([]);
  const [noteDays, setNoteDays] = useState<string[]>([]);
  const [todayKey, setTodayKey] = useState(formatLocalDate(today));
  const [baselineMarks, setBaselineMarks] = useState<Set<string> | null>(null);
  const [draftMarks, setDraftMarks] = useState<Set<string> | null>(null);

  const monthPrefix = getMonthPrefix(year, month);
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const noteSet = useMemo(() => new Set(noteDays), [noteDays]);

  const markedDays = useMemo(() => {
    if (editMode && draftMarks) {
      return filterDatesForMonth(draftMarks, year, month);
    }
    return savedMarkedDays;
  }, [editMode, draftMarks, savedMarkedDays, year, month]);

  const markedSet = useMemo(() => new Set(markedDays), [markedDays]);

  const isFutureDay = (dateKey: string): boolean => dateKey > todayKey;

  const reloadMonthFromDb = async (nextYear: number, nextMonth: number) => {
    const [marks, notes] = await Promise.all([
      getMarkedDaysForMonth(projectId, nextYear, nextMonth),
      getNoteDatesForMonth(projectId, nextYear, nextMonth),
    ]);
    setSavedMarkedDays(marks);
    setNoteDays(notes);
  };

  useEffect(() => {
    void getTodayKey().then(setTodayKey);
  }, []);

  useEffect(() => {
    void reloadMonthFromDb(year, month);
  }, [projectId, year, month]);

  useEffect(() => {
    if (editMode) {
      void getAllMarkedDays(projectId).then((dates) => {
        const initial = new Set(dates);
        setBaselineMarks(initial);
        setDraftMarks(new Set(initial));
      });
      return;
    }

    setBaselineMarks(null);
    setDraftMarks(null);
    void reloadMonthFromDb(year, month);
  }, [editMode, projectId]);

  useImperativeHandle(ref, () => ({
    applyMarks: async () => {
      if (!draftMarks || !baselineMarks) {
        return;
      }

      const add: string[] = [];
      const remove: string[] = [];

      for (const date of draftMarks) {
        if (!baselineMarks.has(date) && !isFutureDay(date)) {
          add.push(date);
        }
      }

      if (canRemoveMarks) {
        for (const date of baselineMarks) {
          if (!draftMarks.has(date)) {
            remove.push(date);
          }
        }
      }

      await syncMarkedDays(projectId, add, remove);
      await reloadMonthFromDb(year, month);
      onChange?.();
    },
  }), [baselineMarks, canRemoveMarks, draftMarks, onChange, projectId, todayKey, year, month]);

  const goToPreviousMonth = () => {
    onSelectDate(null);
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
      return;
    }
    setMonth(month - 1);
  };

  const goToNextMonth = () => {
    onSelectDate(null);
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
      return;
    }
    setMonth(month + 1);
  };

  const handleDayClick = (day: number) => {
    const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;

    if (isFutureDay(dateKey)) {
      return;
    }

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
          const isFuture = isFutureDay(dateKey);
          const isMarked = markedSet.has(dateKey);
          const hasNote = noteSet.has(dateKey);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const canMark = editMode && !isFuture && (!isMarked || canRemoveMarks);

          return (
            <button
              key={dateKey}
              type="button"
              disabled={isFuture}
              className={[
                'calendar-day',
                isFuture ? 'calendar-day-disabled' : '',
                isMarked ? 'calendar-day-marked' : '',
                hasNote ? 'calendar-day-has-note' : '',
                isToday ? 'calendar-day-today' : '',
                isSelected ? 'calendar-day-selected' : '',
                canMark ? 'calendar-day-interactive' : isFuture ? '' : 'calendar-day-selectable',
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
