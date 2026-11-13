import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, BarChart3, FolderKanban, ListTodo, Settings, StickyNote, Trophy, Wallet } from 'lucide-react';
import { getTaskBoard } from '../api/tasks';
import { APP_NAME } from '../config/app';
import { t } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { formatLocalDate } from '../utils/date';
import { sidebarTaskScore } from '../utils/taskUi';
import { TASK_BOARD_CHANGED } from '../utils/taskBoardEvents';
import { mobileHeaderTitleForPath } from '../utils/mobileHeaderTitle';
import { useMobileHeaderTitleContext } from '../context/MobileHeaderTitleContext';
import { SidebarToggle } from './SidebarToggle';
// import { ThemeToggle } from './ThemeToggle';
import '../styles/components/Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth <= 768);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { overrideTitle, subtitle: headerSubtitle } = useMobileHeaderTitleContext();

  const [todayScore, setTodayScore] = useState<{ completed: number; total: number } | null>(null);
  const [isMobileHeader, setIsMobileHeader] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  ));

  useEffect(() => {
    if (!user) {
      setTodayScore(null);
      return;
    }

    let cancelled = false;
    const refreshScore = () => {
      const todayKey = formatLocalDate(new Date());
      void getTaskBoard().then((board) => {
        if (cancelled) return;
        setTodayScore(sidebarTaskScore(board.tasks, todayKey));
      }).catch(() => {
        if (!cancelled) setTodayScore(null);
      });
    };

    refreshScore();
    window.addEventListener(TASK_BOARD_CHANGED, refreshScore);

    return () => {
      cancelled = true;
      window.removeEventListener(TASK_BOARD_CHANGED, refreshScore);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    document.documentElement.classList.remove('theme-light');
    localStorage.setItem('theme', 'dark');
  }, []);

  const displayedAppName = APP_NAME.length > 19 ? `${APP_NAME.substring(0, 19)}...` : APP_NAME;

  const mobilePageTitle = (() => {
    if (location.pathname === '/tasks') {
      return t('tasksTitle');
    }
    const staticTitle = mobileHeaderTitleForPath(location.pathname);
    return overrideTitle ?? staticTitle ?? '';
  })();

  const mobilePageSubtitle = (() => {
    if (location.pathname === '/tasks') {
      return todayScore
        ? `[ ${todayScore.completed} / ${todayScore.total} ]`
        : '[ – / – ]';
    }
    return headerSubtitle ?? '';
  })();

  const desktopScoreText = todayScore
    ? `[ ${todayScore.completed} / ${todayScore.total} ]`
    : '[ – / – ]';

  const logoSubAria = !isMobileHeader && todayScore
    ? t('todayScoreLabel', { completed: todayScore.completed, total: todayScore.total })
    : undefined;

  useEffect(() => {
    if (window.innerWidth <= 768 && !isCollapsed) {
      setIsCollapsed(true);
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 769px)').matches) return;
    setIsCollapsed((collapsed) => !collapsed);
  };

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)');
    const syncLayout = () => {
      setIsMobileHeader(!desktop.matches);
      if (desktop.matches) setIsCollapsed(false);
    };
    syncLayout();
    desktop.addEventListener('change', syncLayout);
    return () => desktop.removeEventListener('change', syncLayout);
  }, []);

  const handleLogout = () => {
    void logout().then(() => navigate('/login'));
  };

  return (
    <div className="layout-wrapper">
      <aside className={isCollapsed ? 'collapsed' : ''}>
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            {isMobileHeader ? (
              <>
                {user && mobilePageTitle && (
                  <div className="logo-brand layout-mobile-page-title">{mobilePageTitle}</div>
                )}
                {user && mobilePageSubtitle && (
                  <div className="logo-sub layout-mobile-page-sub" aria-live="polite">
                    {mobilePageSubtitle}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="logo-brand">{displayedAppName}</div>
                {user && (
                  <div className="logo-sub" aria-label={logoSubAria}>
                    {desktopScoreText}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="sidebar-header-actions">
            {/* <ThemeToggle theme={theme} toggleTheme={toggleTheme} /> */}
            <SidebarToggle isCollapsed={isCollapsed} onClick={toggleSidebar} />
          </div>
        </div>

        <nav>
          <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <ListTodo size={20} />
            <span>{t('navTasks')}</span>
          </NavLink>
          <NavLink to="/finance" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Wallet size={20} />
            <span>{t('navFinance')}</span>
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <FolderKanban size={20} />
            <span>{t('navProjects')}</span>
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
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Settings size={20} />
            <span>{t('navSettings')}</span>
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
