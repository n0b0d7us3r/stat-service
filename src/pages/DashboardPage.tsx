import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { DashboardCollapsibleSection } from '../components/DashboardCollapsibleSection';
import { DashboardWeeklyMatrix } from '../components/DashboardWeeklyMatrix';
import { DashboardMonthTable } from '../components/DashboardMonthTable';
import { DashboardTaskList } from '../components/DashboardTaskList';
import { DashboardTodayGoals } from '../components/DashboardTodayGoals';
import { APP_NAME } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { getUserAchievements } from '../api/achievements';
import { getDashboardStats } from '../api/dashboard';
import { getTodayKey } from '../api/marks';
import { getTaskBoard } from '../api/tasks';
import type { DashboardStats, Task, UserAchievementView } from '../types';
import { addDays, formatLocalDate, parseLocalDate } from '../utils/date';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayKey, setTodayKey] = useState('');

  const reload = useCallback(() => {
    if (!user) return;
    void Promise.all([
      getDashboardStats(user.id),
      getUserAchievements(user.id),
      getTaskBoard().catch(() => ({ tasks: [] as Task[], tags: [] })),
      getTodayKey().catch(() => formatLocalDate(new Date())),
    ]).then(([nextStats, achievements, board, today]) => {
      setStats(nextStats);
      setEarnedAchievements(achievements.filter((item) => item.earned && item.earned_at));
      setTasks(board.tasks);
      setTodayKey(today);
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
  const tomorrowKey = todayKey
    ? formatLocalDate(addDays(parseLocalDate(todayKey), 1))
    : '';
  const tasksToday = tasks.filter((task) => task.due_date === todayKey);
  const tasksTomorrow = tasks.filter((task) => task.due_date === tomorrowKey);

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

          <DashboardCollapsibleSection title="Список задач на сегодня" defaultExpandedOnMobile>
            <DashboardTaskList tasks={tasksToday} emptyText="На сегодня задач нет." />
          </DashboardCollapsibleSection>

          <DashboardCollapsibleSection title="Список задач на завтра" defaultExpandedOnMobile>
            <DashboardTaskList tasks={tasksTomorrow} emptyText="На завтра задач нет." />
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
