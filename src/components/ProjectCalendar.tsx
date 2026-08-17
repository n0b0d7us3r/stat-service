import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAllGoalDays, getGoalDaysForMonth, syncGoalDays } from '../api/goals';
import { getNoteDatesForMonth } from '../api/notes';
import { getAllMarkedDays, getMarkedDaysForMonth, getTodayKey, syncMarkedDays } from '../api/marks';
import type { Achievement, ProjectType } from '../types';
import {
  formatLocalDate,
  getCalendarGrid,
  getMonthLabel,
  getMonthPrefix,
} from '../utils/date';
import '../styles/components/ProjectCalendar.css';

export interface ProjectCalendarHandle {
  applyMarks: () => Promise<Achievement[]>;
}

type EditLayer = 'goals' | 'marks';

interface ProjectCalendarProps {
  projectId: number;
  projectType: ProjectType;
  editMode: boolean;
  isAdmin: boolean;
  isMutable: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onChange?: () => void;
  onMonthChange?: (year: number, month: number) => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function filterDatesForMonth(dates: Iterable<string>, year: number, month: number): string[] {
  const prefix = getMonthPrefix(year, month);
  return [...dates].filter((date) => date.startsWith(`${prefix}-`)).sort();
}

function diffSets(current: Set<string>, baseline: Set<string>): { add: string[]; remove: string[] } {
  const add: string[] = [];
  const remove: string[] = [];

  for (const date of current) {
    if (!baseline.has(date)) {
      add.push(date);
    }
  }

  for (const date of baseline) {
    if (!current.has(date)) {
      remove.push(date);
    }
  }

  return { add, remove };
}

export const ProjectCalendar = forwardRef<ProjectCalendarHandle, ProjectCalendarProps>(function ProjectCalendar(
  {
    projectId,
    projectType,
    editMode,
    isAdmin,
    isMutable,
    selectedDate,
    onSelectDate,
    onChange,
    onMonthChange,
  },
  ref,
) {
  const isGoalsProject = projectType === 'goals';
  const canRemove = isMutable;
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [savedMarkedDays, setSavedMarkedDays] = useState<string[]>([]);
  const [savedGoalDays, setSavedGoalDays] = useState<string[]>([]);
  const [noteDays, setNoteDays] = useState<string[]>([]);
  const [todayKey, setTodayKey] = useState(formatLocalDate(today));
  const [editLayer, setEditLayer] = useState<EditLayer>('marks');
  const [baselineMarks, setBaselineMarks] = useState<Set<string> | null>(null);
  const [draftMarks, setDraftMarks] = useState<Set<string> | null>(null);
  const [baselineGoals, setBaselineGoals] = useState<Set<string> | null>(null);
  const [draftGoals, setDraftGoals] = useState<Set<string> | null>(null);

  const monthPrefix = getMonthPrefix(year, month);
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const noteSet = useMemo(() => new Set(noteDays), [noteDays]);

  const markedDays = useMemo(() => {
    if (editMode && draftMarks) {
      return filterDatesForMonth(draftMarks, year, month);
    }
    return savedMarkedDays;
  }, [editMode, draftMarks, savedMarkedDays, year, month]);

  const goalDays = useMemo(() => {
    if (editMode && draftGoals) {
      return filterDatesForMonth(draftGoals, year, month);
    }
    return savedGoalDays;
  }, [editMode, draftGoals, savedGoalDays, year, month]);

  const markedSet = useMemo(() => new Set(markedDays), [markedDays]);
  const goalSet = useMemo(() => new Set(goalDays), [goalDays]);

  const isFutureDay = (dateKey: string): boolean => dateKey > todayKey;
  const isPastDay = (dateKey: string): boolean => dateKey < todayKey;

  const reloadMonthFromDb = async (nextYear: number, nextMonth: number) => {
    const requests: [Promise<string[]>, Promise<string[]>, Promise<string[]>] = [
      getMarkedDaysForMonth(projectId, nextYear, nextMonth),
      getNoteDatesForMonth(projectId, nextYear, nextMonth),
      isGoalsProject
        ? getGoalDaysForMonth(projectId, nextYear, nextMonth)
        : Promise.resolve([]),
    ];

    const [marks, notes, goals] = await Promise.all(requests);
    setSavedMarkedDays(marks);
    setNoteDays(notes);
    setSavedGoalDays(goals);
  };

  useEffect(() => {
    void getTodayKey().then(setTodayKey);
  }, []);

  useEffect(() => {
    onMonthChange?.(year, month);
  }, [year, month, onMonthChange]);

  useEffect(() => {
    void reloadMonthFromDb(year, month);
  }, [projectId, year, month, isGoalsProject]);

  useEffect(() => {
    if (editMode) {
      void Promise.all([
        getAllMarkedDays(projectId),
        isGoalsProject ? getAllGoalDays(projectId) : Promise.resolve([]),
      ]).then(([marks, goals]) => {
        const initialMarks = new Set(marks);
        setBaselineMarks(initialMarks);
        setDraftMarks(new Set(initialMarks));

        if (isGoalsProject) {
          const initialGoals = new Set(goals);
          setBaselineGoals(initialGoals);
          setDraftGoals(new Set(initialGoals));
          setEditLayer('marks');
        } else {
          setBaselineGoals(null);
          setDraftGoals(null);
        }
      });
      return;
    }

    setBaselineMarks(null);
    setDraftMarks(null);
    setBaselineGoals(null);
    setDraftGoals(null);
    void reloadMonthFromDb(year, month);
  }, [editMode, projectId, isGoalsProject]);

  useEffect(() => {
    if (editMode) {
      onSelectDate(null);
    }
  }, [editMode, onSelectDate]);

  useImperativeHandle(ref, () => ({
    applyMarks: async () => {
      if (!draftMarks || !baselineMarks) {
        return [];
      }

      const markAdd: string[] = [];
      const markRemove: string[] = [];

      for (const date of draftMarks) {
        if (!baselineMarks.has(date) && !isFutureDay(date)) {
          if (isGoalsProject && draftGoals && !draftGoals.has(date)) {
            continue;
          }
          markAdd.push(date);
        }
      }

      if (canRemove) {
        for (const date of baselineMarks) {
          if (!draftMarks.has(date)) {
            markRemove.push(date);
          }
        }
      }

      if (isGoalsProject && draftGoals && baselineGoals) {
        const { remove: goalRemove } = diffSets(draftGoals, baselineGoals);
        const allowedGoalRemove = canRemove ? goalRemove : [];

        for (const date of allowedGoalRemove) {
          if (baselineMarks.has(date) && !markRemove.includes(date)) {
            markRemove.push(date);
          }
        }
      }

      const newlyEarned = await syncMarkedDays(projectId, markAdd, markRemove);
      const earnedIds = new Set(newlyEarned.map((achievement) => achievement.id));

      if (isGoalsProject && draftGoals && baselineGoals) {
        const { add: goalAdd, remove: goalRemove } = diffSets(draftGoals, baselineGoals);
        const allowedGoalRemove = canRemove ? goalRemove : [];
        const goalEarned = await syncGoalDays(projectId, goalAdd, allowedGoalRemove);

        for (const achievement of goalEarned) {
          if (!earnedIds.has(achievement.id)) {
            newlyEarned.push(achievement);
            earnedIds.add(achievement.id);
          }
        }
      }

      await reloadMonthFromDb(year, month);
      onChange?.();

      return newlyEarned;
    },
  }), [
    baselineGoals,
    baselineMarks,
    canRemove,
    draftGoals,
    draftMarks,
    isGoalsProject,
    onChange,
    projectId,
    todayKey,
    year,
    month,
  ]);

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

  const toggleDraftSet = (
    dateKey: string,
    draft: Set<string> | null,
    setter: React.Dispatch<React.SetStateAction<Set<string> | null>>,
    hasDate: boolean,
  ) => {
    if (!draft) return;

    if (hasDate) {
      if (!canRemove) {
        return;
      }

      setter((current) => {
        if (!current) return current;
        const next = new Set(current);
        next.delete(dateKey);
        return next;
      });
      return;
    }

    setter((current) => {
      if (!current) return current;
      const next = new Set(current);
      next.add(dateKey);
      return next;
    });
  };

  const removeDraftMark = (dateKey: string) => {
    setDraftMarks((current) => {
      if (!current?.has(dateKey)) return current;
      const next = new Set(current);
      next.delete(dateKey);
      return next;
    });
  };

  const handleDayClick = (day: number) => {
    const dateKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;

    if (editMode) {
      if (isGoalsProject && editLayer === 'goals') {
        const hadGoal = goalSet.has(dateKey);
        toggleDraftSet(dateKey, draftGoals, setDraftGoals, hadGoal);
        if (hadGoal && canRemove) {
          removeDraftMark(dateKey);
        }
        return;
      }

      if (isGoalsProject && !goalSet.has(dateKey)) {
        return;
      }

      if (isFutureDay(dateKey)) {
        return;
      }

      toggleDraftSet(dateKey, draftMarks, setDraftMarks, markedSet.has(dateKey));
      return;
    }

    if (selectedDate === dateKey) {
      onSelectDate(null);
      return;
    }

    onSelectDate(dateKey);
  };

  const editHint = editMode
    ? isGoalsProject
      ? editLayer === 'goals'
        ? canRemove
          ? 'Режим «Цели»: добавляйте или снимайте цели на любые дни. Сохранение — «Готово».'
          : 'Режим «Цели»: можно только добавлять цели. Сохранение — «Готово».'
        : canRemove
          ? 'Режим «Отметки»: отметки только на днях с целью, за сегодня и прошлые дни. Сохранение — «Готово».'
          : 'Режим «Отметки»: можно ставить отметки только на днях с целью, за сегодня и прошлые дни.'
      : canRemove
        ? 'Отметки сохранятся после «Готово». «Отменить» сбросит изменения.'
        : 'Можно только добавлять отметки. Сохранение — после «Готово», отмена — «Отменить».'
    : null;

  return (
    <div className={`project-calendar ${editMode ? 'project-calendar-editing' : 'project-calendar-readonly'} ${isGoalsProject ? 'project-calendar-goals' : ''} ${projectType === 'calendar' ? 'project-calendar-calendar' : ''}`}>
      <div className="project-calendar-header">
        <button type="button" className="calendar-nav-btn" onClick={goToPreviousMonth} aria-label="Предыдущий месяц">
          <ChevronLeft size={18} />
        </button>
        <h2 className="project-calendar-title">{getMonthLabel(year, month)}</h2>
        <button type="button" className="calendar-nav-btn" onClick={goToNextMonth} aria-label="Следующий месяц">
          <ChevronRight size={18} />
        </button>
      </div>

      {isGoalsProject && editMode && (
        <div className="project-calendar-edit-layers" role="tablist" aria-label="Режим редактирования">
          <button
            type="button"
            role="tab"
            aria-selected={editLayer === 'marks'}
            className={`project-calendar-edit-layer ${editLayer === 'marks' ? 'active' : ''}`}
            onClick={() => setEditLayer('marks')}
          >
            Отметки
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={editLayer === 'goals'}
            className={`project-calendar-edit-layer ${editLayer === 'goals' ? 'active' : ''}`}
            onClick={() => setEditLayer('goals')}
          >
            Цели
          </button>
        </div>
      )}

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
          const isPast = isPastDay(dateKey);
          const isMarked = markedSet.has(dateKey);
          const isGoal = goalSet.has(dateKey);
          const hasNote = noteSet.has(dateKey);
          const isSelected = !editMode && dateKey === selectedDate;
          const isGoalSuccess = isGoalsProject && isGoal && isMarked;
          const isGoalMissed = isGoalsProject && isGoal && isPast && !isMarked;

          const canEditGoals = editMode && isGoalsProject && editLayer === 'goals' && (!isGoal || canRemove);
          const canEditMarks = editMode
            && (!isGoalsProject || editLayer === 'marks')
            && (!isGoalsProject || isGoal)
            && !isFuture
            && (!isMarked || canRemove);
          const canInteract = canEditGoals || canEditMarks;
          const isFutureDisabledForEdit = editMode && isFuture && !canEditGoals;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={isFutureDisabledForEdit}
              className={[
                'calendar-day',
                isFutureDisabledForEdit ? 'calendar-day-disabled' : '',
                !isGoalsProject && isMarked ? 'calendar-day-marked' : '',
                isGoalsProject && isGoal && !isGoalSuccess && !isGoalMissed ? 'calendar-day-goal' : '',
                isGoalSuccess ? 'calendar-day-goal-success' : '',
                isGoalMissed ? 'calendar-day-goal-missed' : '',
                hasNote ? 'calendar-day-has-note' : '',
                isSelected ? 'calendar-day-selected' : '',
                canInteract ? 'calendar-day-interactive' : '',
                !editMode || canInteract ? 'calendar-day-selectable' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleDayClick(day)}
            >
              <span className="calendar-day-number">{day}</span>
              {hasNote && <span className="calendar-day-note-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <p className="project-calendar-hint">
        {editHint ?? (
          isGoalsProject ? (
            <>
              Клик по дню открывает заметку. Зелёный — цель выполнена, красный — пропуск. Сегодня:{' '}
              <span className="project-calendar-hint-today">{todayKey}</span>.
            </>
          ) : (
            <>
              Клик по дню открывает заметку. Сегодня:{' '}
              <span className="project-calendar-hint-today">{todayKey}</span>.
            </>
          )
        )}
      </p>
    </div>
  );
});
