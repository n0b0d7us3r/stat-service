import { Target } from 'lucide-react';
import type { DashboardTodayGoals as DashboardTodayGoalsData } from '../types';
import { projectTypeLabel, t } from '../i18n';
import '../styles/components/DashboardTodayGoals.css';

interface DashboardTodayGoalsProps {
  data: DashboardTodayGoalsData;
  onProjectClick: (projectId: number) => void;
}

export function DashboardTodayGoals({ data, onProjectClick }: DashboardTodayGoalsProps) {
  const completedCount = data.goals.filter((goal) => goal.completed).length;

  return (
    <section className="dashboard-today-goals">
      {data.goals.length === 0 ? (
        <div className="dashboard-today-goals-empty app-border-card">
          <Target size={28} aria-hidden="true" />
          <p>{t('noGoalsToday')}</p>
        </div>
      ) : (
        <>
          <p className="dashboard-today-goals-summary">
            {t('goalsDoneOf', { completed: completedCount, total: data.goals.length })}
          </p>
          <ul className="dashboard-today-goals-list">
            {data.goals.map((goal) => (
              <li key={goal.projectId}>
                <button
                  type="button"
                  className={`dashboard-today-goals-item app-border-card ${goal.completed ? 'dashboard-today-goals-item-done' : 'dashboard-today-goals-item-pending'}`}
                  onClick={() => onProjectClick(goal.projectId)}
                >
                  <span className="dashboard-today-goals-project">{goal.projectName}</span>
                  <span className="dashboard-today-goals-meta">
                    <span className="dashboard-today-goals-type">{projectTypeLabel(goal.projectType)}</span>
                    <span className="dashboard-today-goals-status">
                      {goal.completed ? t('statusDone') : t('statusWaiting')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
