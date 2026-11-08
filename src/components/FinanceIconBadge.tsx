import { financeIcon } from '../utils/financeIcons';

interface FinanceIconBadgeProps {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const ICON_SIZE = { sm: 14, md: 18, lg: 30 } as const;

export function FinanceIconBadge({ icon, color, size = 'md' }: FinanceIconBadgeProps) {
  const Icon = financeIcon(icon);
  return (
    <span className={`finance-icon-badge finance-icon-badge-${size}`} style={{ backgroundColor: color }} aria-hidden="true">
      <Icon size={ICON_SIZE[size]} strokeWidth={2.4} />
    </span>
  );
}
