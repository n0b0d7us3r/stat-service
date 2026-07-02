import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

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
}

export function DashboardCollapsibleSection({
  title,
  children,
  className = '',
  defaultExpandedOnMobile = false,
}: DashboardCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(() => getInitialExpanded(defaultExpandedOnMobile));

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
