import { useMemo } from 'react';
import type { Task } from '../types';
import { activityWeekdayLabels, t } from '../i18n';
import {
  activityLevel,
  buildTaskActivityGrid,
  buildTaskCompletionCounts,
  formatActivityDayLabel,
} from '../utils/taskActivity';
import '../styles/components/TaskActivityCalendar.css';

interface TaskActivityCalendarProps {
  tasks: Task[];
}

const WEEKDAY_LABELS = activityWeekdayLabels;

export function TaskActivityCalendar({ tasks }: TaskActivityCalendarProps) {
  const { columns, monthLabels, counts, totalCompleted } = useMemo(() => {
    const completionCounts = buildTaskCompletionCounts(tasks);
    const grid = buildTaskActivityGrid();
    let total = 0;

    for (const value of completionCounts.values()) {
      total += value;
    }

    return {
      columns: grid.columns,
      monthLabels: grid.monthLabels,
      counts: completionCounts,
      totalCompleted: total,
    };
  }, [tasks]);

  return (
    <aside className="task-activity-calendar" aria-label={t('activityCalendar')}>
      <div className="task-activity-calendar-header">
        <h2 className="task-activity-calendar-title">{t('activity')}</h2>
        <p className="task-activity-calendar-summary">
          {totalCompleted > 0
            ? t('activityYear', { count: totalCompleted })
            : t('activityEmpty')}
        </p>
      </div>

      <div className="task-activity-calendar-scroll">
        <div
          className="task-activity-calendar-months"
          style={{ gridTemplateColumns: `repeat(${columns.length}, var(--activity-cell-size))` }}
        >
          {monthLabels.map((item) => (
            <span
              key={`${item.weekIndex}-${item.label}`}
              className="task-activity-calendar-month"
              style={{ gridColumnStart: item.weekIndex + 1 }}
            >
              {item.label}
            </span>
          ))}
        </div>

        <div className="task-activity-calendar-body">
          <div className="task-activity-calendar-weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((label, index) => (
              <span key={`weekday-${index}`} className="task-activity-calendar-weekday">
                {label}
              </span>
            ))}
          </div>

          <div className="task-activity-calendar-grid" role="grid" aria-label={t('activityGrid')}>
            {columns.map((column, weekIndex) => (
              <div key={`week-${weekIndex}`} className="task-activity-calendar-week" role="row">
                {column.days.map((dateKey, dayIndex) => {
                  if (!dateKey) {
                    return (
                      <span
                        key={`empty-${weekIndex}-${dayIndex}`}
                        className="task-activity-calendar-cell task-activity-calendar-cell-empty"
                        role="gridcell"
                        aria-hidden="true"
                      />
                    );
                  }

                  const count = counts.get(dateKey) ?? 0;
                  const level = activityLevel(count);

                  const label = formatActivityDayLabel(dateKey, count);

                  return (
                    <span
                      key={dateKey}
                      role="gridcell"
                      className={`task-activity-calendar-cell task-activity-calendar-cell-level-${level}`}
                      title={label}
                      aria-label={label}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="task-activity-calendar-legend" aria-hidden="true">
        <span>{t('less')}</span>
        <span className="task-activity-calendar-cell task-activity-calendar-cell-level-0" />
        <span className="task-activity-calendar-cell task-activity-calendar-cell-level-1" />
        <span className="task-activity-calendar-cell task-activity-calendar-cell-level-2" />
        <span className="task-activity-calendar-cell task-activity-calendar-cell-level-3" />
        <span className="task-activity-calendar-cell task-activity-calendar-cell-level-4" />
        <span>{t('more')}</span>
      </div>
    </aside>
  );
}
