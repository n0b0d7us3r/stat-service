import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, FolderKanban, Trophy } from 'lucide-react';
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

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const APP_NAME = import.meta.env.VITE_APP_NAME || 'Game Stat';
  const displayedAppName = APP_NAME.length > 19 ? `${APP_NAME.substring(0, 19)}...` : APP_NAME;

  useEffect(() => {
    if (window.innerWidth <= 768 && !isCollapsed) {
      setIsCollapsed(true);
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-wrapper">
      <aside className={isCollapsed ? 'collapsed' : ''}>
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <div className="logo-brand">{displayedAppName}</div>
            <div className="logo-sub">планер</div>
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
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <LayoutDashboard size={20} />
            <span>ДАШБОРД</span>
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <FolderKanban size={20} />
            <span>ПРОЕКТЫ</span>
          </NavLink>
          <NavLink to="/achievements" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Trophy size={20} />
            <span>ДОСТИЖЕНИЯ</span>
          </NavLink>

          <button
            className="nav-item logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>ВЫХОД</span>
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
