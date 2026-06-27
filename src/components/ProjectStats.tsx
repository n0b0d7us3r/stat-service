import type { ProjectStats as ProjectStatsData, ProjectType } from '../types';
import { getMonthLabel } from '../utils/date';
import { CircularChart } from './CircularChart';
import '../styles/components/ProjectStats.css';

interface ProjectStatsProps {
  stats: ProjectStatsData;
  projectType?: ProjectType;
  viewYear: number;
  viewMonth: number;
}

export function ProjectStats({
  stats,
  projectType = 'calendar',
  viewYear,
  viewMonth,
}: ProjectStatsProps) {
  const isGoalsProject = projectType === 'goals';
  const monthLabel = getMonthLabel(viewYear, viewMonth);
  const today = new Date();
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;

  return (
    <div className={`project-stats ${isGoalsProject ? 'project-stats-goals' : ''}`}>
      <article className="project-stat-card">
        <span className="project-stat-label">
          {isGoalsProject ? 'Выполнено целей' : 'Отметок'}
        </span>
        <strong className="project-stat-value">{stats.totalMarked}</strong>
        <span className="project-stat-meta">
          {isGoalsProject ? `из ${stats.daysInMonth} целей` : `из ${stats.daysInMonth} дней`}
        </span>
      </article>

      <article className="project-stat-card">
        <span className="project-stat-label">{monthLabel}</span>
        <strong className="project-stat-value">{stats.markedThisMonth}</strong>
        <span className="project-stat-meta">
          {isGoalsProject ? 'выполнено за месяц' : 'отмечено за месяц'}
        </span>
      </article>

      <article className="project-stat-card project-stat-card-progress">
        <span className="project-stat-label">Прогресс месяца</span>
        <div className="project-stat-progress-row">
          <strong className="project-stat-value">{stats.monthProgress}%</strong>
          <CircularChart
            value={stats.monthProgress}
            size={44}
            strokeWidth={4}
            aria-label={`Прогресс месяца ${stats.monthProgress}%`}
          />
        </div>
      </article>

      {!isGoalsProject && (
        <>
          <article className="project-stat-card">
            <span className="project-stat-label">Серия в месяце</span>
            <strong className="project-stat-value">{stats.currentStreak} дн.</strong>
            <span className="project-stat-meta">
              {isCurrentMonth ? 'От сегодня' : 'На конец месяца'}
            </span>
          </article>

          <article className="project-stat-card">
            <span className="project-stat-label">Рекорд в месяце</span>
            <strong className="project-stat-value">{stats.longestStreak} дн.</strong>
            <span className="project-stat-meta">Лучшая подряд</span>
          </article>
        </>
      )}
    </div>
  );
}
