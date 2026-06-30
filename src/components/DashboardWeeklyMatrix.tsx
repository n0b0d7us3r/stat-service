import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DashboardWeekDayCell, DashboardWeeklyMatrix as DashboardWeeklyMatrixData, ProjectType } from '../types';
import { parseLocalDate } from '../utils/date';
import '../styles/components/DashboardWeeklyMatrix.css';

interface DashboardWeeklyMatrixProps {
  matrix: DashboardWeeklyMatrixData;
  onProjectClick: (projectId: number) => void;
}

const CELL_LABELS = {
  empty: 'Нет отметки',
  marked: 'Отмечено',
  'goal-success': 'Цель выполнена',
  'goal-missed': 'Цель пропущена',
  'goal-pending': 'Цель без отметки',
} as const;

const WEEK_DIVIDER_INDICES = new Set([6, 13]);
const WEEK_START_INDICES = new Set([7, 14]);
const MOBILE_MATRIX_DAYS = 21;

function formatWeekdayHeader(dateKey: string): string {
  return parseLocalDate(dateKey).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
  });
}

function DayCell({
  day,
  label,
  projectType,
}: {
  day: DashboardWeekDayCell;
  label: string;
  projectType: ProjectType;
}) {
  const isCalendarMarked = projectType === 'calendar' && day.state === 'marked';

  return (
    <span
      className={[
        'dashboard-week-matrix-cell',
        `dashboard-week-matrix-cell-${day.state}`,
        isCalendarMarked ? 'dashboard-week-matrix-cell-marked-calendar' : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${label}, ${formatWeekdayHeader(day.date)}: ${CELL_LABELS[day.state]}`}
    />
  );
}

function chunkWeeks(days: DashboardWeekDayCell[]): DashboardWeekDayCell[][] {
  const weeks: DashboardWeekDayCell[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function dayCellClassName(index: number): string {
  return [
    'dashboard-week-matrix-day',
    index === 0 ? 'dashboard-week-matrix-day-after-project' : '',
    WEEK_DIVIDER_INDICES.has(index) ? 'dashboard-week-matrix-day-week-divider' : '',
    WEEK_START_INDICES.has(index) ? 'dashboard-week-matrix-day-week-start' : '',
  ].filter(Boolean).join(' ');
}

export function DashboardWeeklyMatrix({ matrix, onProjectClick }: DashboardWeeklyMatrixProps) {
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);

  const toggleProject = (projectId: number) => {
    setExpandedProjectId((current) => (current === projectId ? null : projectId));
  };

  return (
    <>
      <div className="dashboard-week-matrix-wrapper dashboard-week-matrix-desktop">
        <table className="dashboard-week-matrix">
          <thead>
            <tr>
              <th className="dashboard-week-matrix-project-header align-left">Проект</th>
              {matrix.dates.map((date, index) => (
                <th key={date} className={dayCellClassName(index)}>
                  {formatWeekdayHeader(date)}
                </th>
              ))}
              {/* <th className="dashboard-week-matrix-progress-header">3 недели</th> */}
            </tr>
          </thead>
          <tbody>
            {matrix.projects.map((project) => (
              <tr key={project.id} className="dashboard-week-matrix-row">
                <td className="dashboard-week-matrix-project align-left">
                  <button
                    type="button"
                    className="dashboard-week-matrix-project-btn"
                    onClick={() => onProjectClick(project.id)}
                  >
                    {project.name}
                  </button>
                </td>
                {project.days.map((day, index) => (
                  <td key={`${project.id}-${day.date}`} className={dayCellClassName(index)}>
                    <DayCell day={day} label={project.name} projectType={project.project_type} />
                  </td>
                ))}
                {/* <td className="dashboard-week-matrix-progress">{project.weekProgress}%</td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-week-matrix-mobile">
        {matrix.projects.map((project) => {
          const isExpanded = expandedProjectId === project.id;
          const mobileDays = project.days.slice(-MOBILE_MATRIX_DAYS);

          return (
            <article
              key={project.id}
              className={`dashboard-week-matrix-mobile-card ${isExpanded ? 'expanded' : ''}`}
            >
              <button
                type="button"
                className="dashboard-week-matrix-mobile-toggle"
                onClick={() => toggleProject(project.id)}
                aria-expanded={isExpanded}
              >
                <span className="dashboard-week-matrix-mobile-name">{project.name}</span>
                <span className="dashboard-week-matrix-mobile-summary">
                  {/* <span className="dashboard-week-matrix-mobile-progress">{project.weekProgress}%</span> */}
                  <ChevronDown size={18} className="dashboard-week-matrix-mobile-chevron" />
                </span>
              </button>

              {isExpanded && (
                <div className="dashboard-week-matrix-mobile-weeks">
                  {chunkWeeks(mobileDays).map((week, weekIndex) => (
                    <div key={`${project.id}-week-${weekIndex}`} className="dashboard-week-matrix-mobile-week">
                      {week.map((day) => (
                        <div key={`${project.id}-${day.date}`} className="dashboard-week-matrix-mobile-day">
                          <span className="dashboard-week-matrix-mobile-day-label">
                            {formatWeekdayHeader(day.date)}
                          </span>
                          <DayCell day={day} label={project.name} projectType={project.project_type} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
