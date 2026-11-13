import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/components/DashboardCollapsibleSection.css';

const MOBILE_BREAKPOINT = 768;

function getInitialExpanded(defaultExpandedOnMobile: boolean): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.innerWidth > MOBILE_BREAKPOINT || defaultExpandedOnMobile;
}

interface DashboardCollapsibleSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  defaultExpandedOnMobile?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function DashboardCollapsibleSection({
  title,
  children,
  className = '',
  defaultExpandedOnMobile = false,
  expanded: expandedProp,
  onExpandedChange,
}: DashboardCollapsibleSectionProps) {
  const [expandedInternal, setExpandedInternal] = useState(() => getInitialExpanded(defaultExpandedOnMobile));
  const expanded = expandedProp ?? expandedInternal;

  const setExpanded = (value: boolean | ((current: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(expanded) : value;
    onExpandedChange?.(next);
    if (expandedProp === undefined) {
      setExpandedInternal(next);
    }
  };

  return (
    <section
      className={`dashboard-collapsible-section ${expanded ? 'expanded' : 'collapsed'} ${className}`.trim()}
    >
      <button
        type="button"
        className="dashboard-collapsible-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <ChevronDown size={18} className="dashboard-collapsible-toggle-icon" aria-hidden="true" />
      </button>
      <h2 className="dashboard-section-title dashboard-collapsible-title">{title}</h2>
      <div className="dashboard-collapsible-panel">{children}</div>
    </section>
  );
}
