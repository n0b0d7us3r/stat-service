import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { DashboardCollapsibleSection } from './DashboardCollapsibleSection';
import { t } from '../i18n';
import '../styles/components/FilterSection.css';

const MOBILE_BREAKPOINT = 768;

function getInitialExpanded(defaultExpandedOnMobile: boolean): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.innerWidth > MOBILE_BREAKPOINT || defaultExpandedOnMobile;
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
}

export interface FilterSectionHandle {
  collapse: () => void;
}

interface FilterSectionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  defaultExpandedOnMobile?: boolean;
}

/** Сворачиваемый блок «Фильтр» для списков и таблиц (мобилка — аккордеон, десктоп — заголовок + панель). */
export const FilterSection = forwardRef<FilterSectionHandle, FilterSectionProps>(function FilterSection(
  {
    children,
    className = '',
    title,
    defaultExpandedOnMobile = false,
  },
  ref,
) {
  const [expanded, setExpanded] = useState(() => getInitialExpanded(defaultExpandedOnMobile));

  const collapse = useCallback(() => {
    if (isMobileViewport()) {
      setExpanded(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({ collapse }), [collapse]);

  const handlePanelChange = () => {
    collapse();
  };

  return (
    <DashboardCollapsibleSection
      title={title ?? t('filter')}
      className={`app-filter-section ${className}`.trim()}
      defaultExpandedOnMobile={defaultExpandedOnMobile}
      expanded={expanded}
      onExpandedChange={setExpanded}
    >
      <div className="app-filter-section-body" onChange={handlePanelChange}>
        {children}
      </div>
    </DashboardCollapsibleSection>
  );
});
