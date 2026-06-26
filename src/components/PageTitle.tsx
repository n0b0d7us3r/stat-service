import type { ReactNode } from 'react';

interface PageTitleProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function PageTitle({ children, title, subtitle, className = '' }: PageTitleProps) {
  const content = children ?? title;

  return (
    <div className={`page-title-block ${className}`}>
      <h1 className="page-title">{content}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}
