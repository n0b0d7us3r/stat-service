import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AchievementCelebrationProvider } from '../context/AchievementCelebrationContext';
import { t } from '../i18n';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <p>{t('checkingSession')}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AchievementCelebrationProvider>
      {children}
    </AchievementCelebrationProvider>
  );
}
