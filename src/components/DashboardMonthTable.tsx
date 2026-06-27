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
                <th>Сделано</th>
                <th>Всего</th>
                <th>Прогресс</th>
              </tr>
            </thead>
            <tbody>
              {stats.projects.map((project) => (
                <tr
                  key={project.id}
                  className="dashboard-month-row"
                  onClick={() => onProjectClick(project.id)}
                >
                  <td className="dashboard-month-project-name">{project.name}</td>
                  <td data-label="Сделано">{project.completed}</td>
                  <td data-label="Всего">{project.total}</td>
                  <td data-label="Прогресс">{project.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
