import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface MobileHeaderTitleContextValue {
  overrideTitle: string | null;
  setOverrideTitle: (title: string | null) => void;
  subtitle: string | null;
  setSubtitle: (subtitle: string | null) => void;
}

const MobileHeaderTitleContext = createContext<MobileHeaderTitleContextValue | null>(null);

export function MobileHeaderTitleProvider({ children }: { children: ReactNode }) {
  const [overrideTitle, setOverrideTitleState] = useState<string | null>(null);
  const [subtitle, setSubtitleState] = useState<string | null>(null);

  const setOverrideTitle = useCallback((title: string | null) => {
    setOverrideTitleState(title);
  }, []);

  const setSubtitle = useCallback((next: string | null) => {
    setSubtitleState(next);
  }, []);

  const value = useMemo(
    () => ({ overrideTitle, setOverrideTitle, subtitle, setSubtitle }),
    [overrideTitle, setOverrideTitle, subtitle, setSubtitle],
  );

  return (
    <MobileHeaderTitleContext.Provider value={value}>
      {children}
    </MobileHeaderTitleContext.Provider>
  );
}

export function useMobileHeaderTitle(title: string | null | undefined): void {
  const context = useContext(MobileHeaderTitleContext);
  if (!context) {
    throw new Error('useMobileHeaderTitle must be used within MobileHeaderTitleProvider');
  }

  const { setOverrideTitle } = context;

  useEffect(() => {
    setOverrideTitle(title ?? null);
    return () => setOverrideTitle(null);
  }, [setOverrideTitle, title]);
}

export function useMobileHeaderSubtitle(text: string | null | undefined): void {
  const context = useContext(MobileHeaderTitleContext);
  if (!context) {
    throw new Error('useMobileHeaderSubtitle must be used within MobileHeaderTitleProvider');
  }

  const { setSubtitle } = context;

  useEffect(() => {
    setSubtitle(text ?? null);
    return () => setSubtitle(null);
  }, [setSubtitle, text]);
}

export function useMobileHeaderTitleContext(): MobileHeaderTitleContextValue {
  const context = useContext(MobileHeaderTitleContext);
  if (!context) {
    throw new Error('useMobileHeaderTitleContext must be used within MobileHeaderTitleProvider');
  }
  return context;
}
