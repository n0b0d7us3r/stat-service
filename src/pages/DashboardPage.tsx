import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { useAuth } from '../context/AuthContext';
import { getUserAchievements } from '../api/achievements';
import { getDashboardStats } from '../api/dashboard';
import type { DashboardStats, UserAchievementView } from '../types';
import '../styles/DashboardPage.css';

function formatEarnedDate(value: string): string {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [earnedAchievements, setEarnedAchievements] = useState<UserAchievementView[]>([]);

  const reload = useCallback(() => {
    if (!user) return;
    void Promise.all([
      getDashboardStats(user.id),
      getUserAchievements(user.id),
    ]).then(([nextStats, achievements]) => {
      setStats(nextStats);
      setEarnedAchievements(achievements.filter((item) => item.earned && item.earned_at));
    });
  }, [user]);

  useEffect(() => {
    document.title = 'Статистика | Game Stat';
    reload();
  }, [reload]);

  if (!stats) {
    return (
      <Layout>
        <div className="dashboard-page">
          <p className="dashboard-placeholder-note">Загрузка статистики...</p>
        </div>
      </Layout>
    );
  }

  const recentAchievements = [...earnedAchievements]
    .sort((a, b) => (b.earned_at ?? '').localeCompare(a.earned_at ?? ''))
    .slice(0, 2);

  return (
    <Layout>
      <div className="dashboard-page">
        <PageTitle title="Статистика" subtitle="Сводка по проектам" />

        {/* <div className="dashboard-summary-grid">
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-label">Проектов</span>
            <strong className="dashboard-stat-value">{stats.projectsCount}</strong>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-label">Всего отметок</span>
            <strong className="dashboard-stat-value">{stats.totalMarked}</strong>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-label">В этом месяце</span>
            <strong className="dashboard-stat-value">{stats.markedThisMonth}</strong>
          </article>
          <article className="dashboard-stat-card dashboard-stat-card-progress">
            <span className="dashboard-stat-label">Прогресс месяца</span>
            <div className="dashboard-stat-progress-row">
              <strong className="dashboard-stat-value">{stats.monthProgress}%</strong>
              <CircularChart
                value={stats.monthProgress}
                size={44}
                strokeWidth={4}
                aria-label={`Прогресс месяца ${stats.monthProgress}%`}
              />
            </div>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-label">Текущая серия</span>
            <strong className="dashboard-stat-value">{stats.bestCurrentStreak} дн.</strong>
            <span className="dashboard-stat-caption">От сегодня, макс. по проектам</span>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-label">Рекорд серии</span>
            <strong className="dashboard-stat-value">{stats.bestLongestStreak} дн.</strong>
            <span className="dashboard-stat-caption">Лучшая подряд за всё время</span>
          </article>
          <article className="dashboard-stat-card">
            <span className="dashboard-stat-label">Достижения</span>
            <strong className="dashboard-stat-value">{earnedCount}</strong>
          </article>
        </div> */}

        <section>
          <h2 className="dashboard-section-title">По проектам</h2>

          {stats.projects.length === 0 ? (
            <div className="dashboard-placeholder">
              <p>Нет проектов. Создайте первый на странице «Проекты».</p>
            </div>
          ) : (
            <div className="dashboard-projects-table-wrapper">
              <table className="dashboard-projects-table">
                <thead>
                  <tr>
                    <th className="align-left">Проект</th>
                    <th>Всего</th>
                    <th>Месяц</th>
                    <th>Серия</th>
                    <th>Рекорд</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.projects.map((project) => (
                    <tr
                      key={project.id}
                      className="dashboard-project-row"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td className="align-left dashboard-project-name">{project.name}</td>
                      <td data-label="Всего">{project.marked_count}</td>
                      <td data-label="Месяц">{project.markedThisMonth}</td>
                      <td data-label="Серия">{project.currentStreak}</td>
                      <td data-label="Рекорд">{project.longestStreak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-recent-achievements-section">
          <h2 className="dashboard-section-title">Последние полученные достижения</h2>

          {recentAchievements.length === 0 ? (
            <div className="dashboard-achievements-empty">
              <p>Пока нет полученных достижений.</p>
              <Link to="/achievements" className="dashboard-achievements-link">
                Посмотреть все достижения
              </Link>
            </div>
          ) : (
            <div className="dashboard-achievements-list">
              {recentAchievements.map((achievement) => (
                <article key={achievement.id} className="dashboard-achievement-card">
                  <div className="dashboard-achievement-icon" aria-hidden="true">
                    <Trophy size={20} />
                  </div>
                  <div className="dashboard-achievement-body">
                    <h3 className="dashboard-achievement-title">{achievement.name}</h3>
                    <p className="dashboard-achievement-description">{achievement.description}</p>
                    {achievement.earned_at && (
                      <p className="dashboard-achievement-date">
                        Получено: {formatEarnedDate(achievement.earned_at)}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
