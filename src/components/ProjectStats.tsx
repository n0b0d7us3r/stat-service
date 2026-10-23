import type { ProjectStats as ProjectStatsData, ProjectType } from '../types';
import { t } from '../i18n';
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
          {isGoalsProject ? t('goalsStat') : t('marksStat')}
        </span>
        <strong className="project-stat-value">{stats.totalMarked}</strong>
        <span className="project-stat-meta">
          {isGoalsProject ? t('ofGoals', { count: stats.daysInMonth }) : t('ofDays', { count: stats.daysInMonth })}
        </span>
      </article>

      <article className="project-stat-card">
        <span className="project-stat-label">{monthLabel}</span>
        <strong className="project-stat-value">{stats.markedThisMonth}</strong>
        <span className="project-stat-meta">
          {isGoalsProject ? t('goalsThisMonth') : t('markedThisMonth')}
        </span>
      </article>

      <article className="project-stat-card project-stat-card-progress">
        <span className="project-stat-label">{t('monthProgress')}</span>
        <div className="project-stat-progress-row">
          <strong className="project-stat-value">{stats.monthProgress}%</strong>
          <CircularChart
            value={stats.monthProgress}
            size={44}
            strokeWidth={4}
            aria-label={t('monthProgressAria', { progress: stats.monthProgress })}
          />
        </div>
      </article>

      {!isGoalsProject && (
        <>
          <article className="project-stat-card">
            <span className="project-stat-label">{t('streakInMonth')}</span>
            <strong className="project-stat-value">{t('daysShort', { count: stats.currentStreak })}</strong>
            <span className="project-stat-meta">
              {isCurrentMonth ? t('fromToday') : t('monthEnd')}
            </span>
          </article>

          <article className="project-stat-card">
            <span className="project-stat-label">{t('recordInMonth')}</span>
            <strong className="project-stat-value">{t('daysShort', { count: stats.longestStreak })}</strong>
            <span className="project-stat-meta">{t('bestRun')}</span>
          </article>
        </>
      )}
    </div>
  );
}
