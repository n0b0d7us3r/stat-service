import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDashboardMonthlyStats } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';
import type { DashboardMonthlyStats } from '../types';
import '../styles/components/DashboardMonthTable.css';

interface DashboardMonthTableProps {
  onProjectClick: (projectId: number) => void;
}

function getMonthLabel(month: number): string {
  const label = new Date(2000, month - 1, 1).toLocaleDateString('ru-RU', { month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthOptions(currentMonth: number): Array<{ value: number; label: string }> {
  return Array.from({ length: 12 }, (_, index) => {
    const month = ((currentMonth - 1 - index + 12) % 12) + 1;
    return { value: month, label: getMonthLabel(month) };
  });
}

const YEAR_RANGE = 10;

function getCurrentYearMonth(): { year: number; month: number } {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

function buildYearOptions(currentYear: number): number[] {
  return Array.from({ length: YEAR_RANGE }, (_, index) => currentYear - index);
}

function truncateProjectName(name: string, maxLength = 20): string {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.slice(0, maxLength)}…`;
}

function ProjectProgressStats({
  completed,
  total,
  progress,
}: {
  completed: number;
  total: number;
  progress: number;
}) {
  return (
    <span className="dashboard-month-project-inline-stats">
      <span className="dashboard-month-stat-ratio">{completed}/{total}</span>
      <span className="dashboard-month-stat-separator" aria-hidden="true">|</span>
      <span className="dashboard-month-stat-percent">{progress}%</span>
    </span>
  );
}

export function DashboardMonthTable({ onProjectClick }: DashboardMonthTableProps) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [{ year, month }, setYearMonth] = useState(getCurrentYearMonth);
  const [stats, setStats] = useState<DashboardMonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const yearOptions = useMemo(() => buildYearOptions(currentYear), [currentYear]);
  const monthOptions = useMemo(() => buildMonthOptions(currentMonth), [currentMonth]);

  const reload = useCallback(() => {
    if (!user) return;

    setLoading(true);
    void getDashboardMonthlyStats(user.id, year, month)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [user, year, month]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="dashboard-month-section">
      <div className="dashboard-month-toolbar">
        <div className="dashboard-month-filters">
          <label className="dashboard-month-filter">
            <span className="dashboard-month-filter-caption">Месяц</span>
            <select
              className="dashboard-month-filter-select"
              value={month}
              onChange={(event) => setYearMonth((current) => ({
                ...current,
                month: Number(event.target.value),
              }))}
              aria-label="Выбор месяца"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-month-filter">
            <span className="dashboard-month-filter-caption">Год</span>
            <select
              className="dashboard-month-filter-select"
              value={year}
              onChange={(event) => setYearMonth((current) => ({
                ...current,
                year: Number(event.target.value),
              }))}
              aria-label="Выбор года"
            >
              {yearOptions.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading || !stats ? (
        <p className="dashboard-month-loading">Загрузка статистики за месяц...</p>
      ) : (
        <div className="dashboard-month-table-wrapper">
          <table className="dashboard-month-table">
            <thead>
              <tr>
                <th className="dashboard-month-project-header">Проект</th>
                <th className="dashboard-month-data-col">Сделано</th>
                <th className="dashboard-month-data-col">Всего</th>
                <th className="dashboard-month-data-col dashboard-month-data-col-progress">Прогресс</th>
              </tr>
            </thead>
            <tbody>
              {stats.projects.map((project) => {
                const isComplete = project.progress >= 100;

                return (
                <tr
                  key={project.id}
                  className={`dashboard-month-row ${isComplete ? 'dashboard-month-row-complete' : ''}`}
                  onClick={() => onProjectClick(project.id)}
                >
                  <td className="dashboard-month-project-name">
                    <span className="dashboard-month-project-name-text" title={project.name}>
                      {truncateProjectName(project.name)}
                    </span>
                    <ProjectProgressStats
                      completed={project.completed}
                      total={project.total}
                      progress={project.progress}
                    />
                  </td>
                  <td className="dashboard-month-data-col" data-label="Сделано">{project.completed}</td>
                  <td className="dashboard-month-data-col" data-label="Всего">{project.total}</td>
                  <td className="dashboard-month-data-col dashboard-month-data-col-progress" data-label="Прогресс">{project.progress}%</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
