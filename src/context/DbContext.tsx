import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initDatabase } from '../db/database';

interface DbContextValue {
  ready: boolean;
  error: string | null;
}

const DbContext = createContext<DbContextValue>({
  ready: false,
  error: null,
});

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    initDatabase()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось инициализировать базу данных');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="db-error-screen">
        <h1>Ошибка базы данных</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="db-loading-screen">
        <p>Загрузка базы данных...</p>
      </div>
    );
  }

  return (
    <DbContext.Provider value={{ ready, error }}>
      {children}
    </DbContext.Provider>
  );
}

export function useDb() {
  return useContext(DbContext);
}
