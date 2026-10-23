import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, BarChart3, FolderKanban, ListTodo, StickyNote, Trophy } from 'lucide-react';
import { getDashboardStats } from '../api/dashboard';
import { getTaskBoard } from '../api/tasks';
import { APP_NAME } from '../config/app';
import { t } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { SidebarToggle } from './SidebarToggle';
import { ThemeToggle } from './ThemeToggle';
import '../styles/components/Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth <= 768);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [todayScore, setTodayScore] = useState<{ tasks: number; goals: number } | null>(null);

  useEffect(() => {
    if (!user) {
      setTodayScore(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      getTaskBoard(),
      getDashboardStats(user.id),
    ]).then(([board, stats]) => {
      if (cancelled) return;
      setTodayScore({
        tasks: board.tasks.filter((task) => !task.archived && !task.completed).length,
        goals: stats.todayGoals.goals.length,
      });
    }).catch(() => {
      if (!cancelled) setTodayScore(null);
    });

    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const displayedAppName = APP_NAME.length > 19 ? `${APP_NAME.substring(0, 19)}...` : APP_NAME;

  useEffect(() => {
    if (window.innerWidth <= 768 && !isCollapsed) {
      setIsCollapsed(true);
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const handleLogout = () => {
    void logout().then(() => navigate('/login'));
  };

  return (
    <div className="layout-wrapper">
      <aside className={isCollapsed ? 'collapsed' : ''}>
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <div className="logo-brand">{displayedAppName}</div>
            <div
              className="logo-sub"
              aria-label={todayScore
                ? t('todayScoreLabel', { tasks: todayScore.tasks, goals: todayScore.goals })
                : undefined}
            >
              {todayScore ? `[ ${todayScore.tasks} / ${todayScore.goals} ]` : '[ – / – ]'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <SidebarToggle isCollapsed={isCollapsed} onClick={toggleSidebar} />
          </div>
        </div>

        <nav>
          {!isCollapsed && user && (
            <div className="sidebar-user-section">
              <div className="sidebar-user-email">{user.email}</div>
            </div>
          )}
          <NavLink to="/projects" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <FolderKanban size={20} />
            <span>{t('navProjects')}</span>
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <ListTodo size={20} />
            <span>{t('navTasks')}</span>
          </NavLink>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <BarChart3 size={20} />
            <span>{t('navStats')}</span>
          </NavLink>
          <NavLink to="/notes" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <StickyNote size={20} />
            <span>{t('navNotes')}</span>
          </NavLink>
          <NavLink to="/achievements" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Trophy size={20} />
            <span>{t('navAchievements')}</span>
          </NavLink>

          <button
            className="nav-item logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>{t('navLogout')}</span>
          </button>
        </nav>
      </aside>

      <div className="mobile-overlay" onClick={() => setIsCollapsed(true)} />

      <main>
        {children}
      </main>
    </div>
  );
}
