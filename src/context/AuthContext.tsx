import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getCurrentUser,
  getStoredSession,
  loginUser,
  logoutUser,
  registerUser,
} from '../db/auth';
import { AuthError, type User } from '../db/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setUser(getCurrentUser());
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    await loginUser(email, password, remember);
    setUser(getCurrentUser());
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const newUser = await registerUser(email, password);
    await loginUser(email, password, true);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { AuthError };
