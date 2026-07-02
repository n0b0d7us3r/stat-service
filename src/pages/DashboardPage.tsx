import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { DashboardCollapsibleSection } from '../components/DashboardCollapsibleSection';
import { DashboardWeeklyMatrix } from '../components/DashboardWeeklyMatrix';
import { DashboardMonthTable } from '../components/DashboardMonthTable';
import { DashboardTodayGoals } from '../components/DashboardTodayGoals';
import { APP_NAME } from '../config/app';
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
    document.title = `Статистика | ${APP_NAME}`;
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
        <PageTitle title="Статистика" />

        <div className="dashboard-stats-sections">
          <DashboardCollapsibleSection title="Цели на сегодня" defaultExpandedOnMobile>
            <DashboardTodayGoals
              data={stats.todayGoals}
              onProjectClick={(projectId) => navigate(`/projects/${projectId}`, { state: { selectedDate: stats.todayGoals.date } })}
            />
          </DashboardCollapsibleSection>

          {stats.projects.length === 0 ? (
            <div className="dashboard-placeholder">
              <p>Нет проектов. Создайте первый на странице «Проекты».</p>
            </div>
          ) : (
            <>
              <DashboardCollapsibleSection title="По месяцам">
                <DashboardMonthTable onProjectClick={(projectId) => navigate(`/projects/${projectId}`)} />
              </DashboardCollapsibleSection>

              <DashboardCollapsibleSection title="По неделям">
                <DashboardWeeklyMatrix
                  matrix={stats.weeklyMatrix}
                  onProjectClick={(projectId) => navigate(`/projects/${projectId}`)}
                />
              </DashboardCollapsibleSection>
            </>
          )}

          <DashboardCollapsibleSection title="Последние полученные достижения">
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
          </DashboardCollapsibleSection>
        </div>
      </div>
    </Layout>
  );
}
