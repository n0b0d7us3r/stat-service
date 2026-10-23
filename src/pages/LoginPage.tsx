import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthError, useAuth } from '../context/AuthContext';
import { Checkbox } from '../components/Checkbox';
// import { ThemeToggle } from '../components/ThemeToggle';
import { APP_NAME } from '../config/app';
import { t } from '../i18n';
import { isPublicRegisterAllowed } from '../config/features';
import '../styles/LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = `${t('loginTitle')} | ${APP_NAME}`;
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    document.documentElement.classList.remove('theme-light');
    localStorage.setItem('theme', 'dark');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      navigate('/');
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError(t('loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo-container">
              <div className="login-logo-brand">{APP_NAME}</div>
              <div className="login-logo-sub">stat</div>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && (
              <div className="login-error">
                <p>{error}</p>
              </div>
            )}

            <input
              type="email"
              required
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder={t('emailPlaceholder')}
            />

            <div className="form-group">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input password-input"
                placeholder={t('passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="password-toggle-btn"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="login-remember-row">
              <Checkbox
                label={t('rememberMe')}
                checked={rememberMe}
                onChange={setRememberMe}
              />
              {/* <ThemeToggle theme={theme} toggleTheme={toggleTheme} /> */}
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? t('loginPending') : t('loginSubmit')}
            </button>

            {isPublicRegisterAllowed && (
              <p className="login-switch-link">
                {t('noAccount')} <Link to="/register">{t('registerLink')}</Link>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
