import type { ReactNode } from 'react';
import { DashboardCollapsibleSection } from './DashboardCollapsibleSection';
import { t } from '../i18n';
import '../styles/components/FilterSection.css';

interface FilterSectionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  defaultExpandedOnMobile?: boolean;
}

/** Сворачиваемый блок «Фильтр» для списков и таблиц (мобилка — аккордеон, десктоп — заголовок + панель). */
export function FilterSection({
  children,
  className = '',
  title,
  defaultExpandedOnMobile = false,
}: FilterSectionProps) {
  return (
    <DashboardCollapsibleSection
      title={title ?? t('filter')}
      className={`app-filter-section ${className}`.trim()}
      defaultExpandedOnMobile={defaultExpandedOnMobile}
    >
      {children}
    </DashboardCollapsibleSection>
  );
}
