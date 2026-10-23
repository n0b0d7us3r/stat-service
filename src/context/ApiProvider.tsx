import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '../api/client';
import { t } from '../i18n';

interface ApiContextValue {
  ready: boolean;
  error: string | null;
}

const ApiContext = createContext<ApiContextValue>({
  ready: false,
  error: null,
});

export function ApiProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ ok: boolean }>('/health')
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('connectionFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="api-error-screen">
        <h1>{t('connectionError')}</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="api-loading-screen">
        <p>{t('connecting')}</p>
      </div>
    );
  }

  return (
    <ApiContext.Provider value={{ ready, error }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  return useContext(ApiContext);
}
