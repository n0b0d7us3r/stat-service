import type { ProjectStats as ProjectStatsData } from '../types';
import { CircularChart } from './CircularChart';
import '../styles/components/ProjectStats.css';

interface ProjectStatsProps {
  stats: ProjectStatsData;
}

export function ProjectStats({ stats }: ProjectStatsProps) {
  return (
    <div className="project-stats">
      <article className="project-stat-card">
        <span className="project-stat-label">Всего отмечено</span>
        <strong className="project-stat-value">{stats.totalMarked}</strong>
      </article>

      <article className="project-stat-card">
        <span className="project-stat-label">В этом месяце</span>
        <strong className="project-stat-value">{stats.markedThisMonth}</strong>
        <span className="project-stat-meta">из {stats.daysInMonth} дней</span>
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

      <article className="project-stat-card">
        <span className="project-stat-label">Текущая серия</span>
        <strong className="project-stat-value">{stats.currentStreak}</strong>
        <span className="project-stat-meta">дней подряд</span>
      </article>

      <article className="project-stat-card">
        <span className="project-stat-label">Лучшая серия</span>
        <strong className="project-stat-value">{stats.longestStreak}</strong>
        <span className="project-stat-meta">дней подряд</span>
      </article>
    </div>
  );
}
