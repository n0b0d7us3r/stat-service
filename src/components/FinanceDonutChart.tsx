import { FinanceIconBadge } from './FinanceIconBadge';
import { formatMoney } from '../utils/finance';

export interface FinanceDonutItem {
  key: string;
  label: string;
  color: string;
  icon: string;
  cents: number;
}

interface FinanceDonutChartProps {
  items: FinanceDonutItem[];
  currency: string;
  totalLabel: string;
}

const RADIUS = 52;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 1.5;

export function FinanceDonutChart({ items, currency, totalLabel }: FinanceDonutChartProps) {
  const total = items.reduce((sum, item) => sum + item.cents, 0);
  let offset = 0;

  return (
    <div className="finance-donut">
      <div className="finance-donut-figure">
        <svg viewBox="0 0 140 140" role="img" aria-label={`${totalLabel}: ${formatMoney(total, currency)}`}>
          <circle className="finance-donut-track" cx="70" cy="70" r={RADIUS} strokeWidth={STROKE} />
          {items.map((item) => {
            const length = total > 0 ? (item.cents / total) * CIRCUMFERENCE : 0;
            const visible = items.length > 1 ? Math.max(length - GAP, 0.5) : length;
            const segment = (
              <circle
                key={item.key}
                cx="70"
                cy="70"
                r={RADIUS}
                fill="none"
                stroke={item.color}
                strokeWidth={STROKE}
                strokeDasharray={`${visible} ${CIRCUMFERENCE - visible}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${item.label}: ${formatMoney(item.cents, currency)}`}</title>
              </circle>
            );
            offset += length;
            return segment;
          })}
        </svg>
        <div className="finance-donut-center">
          <span className="finance-donut-total">{formatMoney(total, currency)}</span>
          <span className="finance-donut-caption">{totalLabel}</span>
        </div>
      </div>

      <ul className="finance-breakdown">
        {items.map((item) => {
          const share = total > 0 ? (item.cents / total) * 100 : 0;
          return (
            <li key={item.key} className="finance-breakdown-item">
              <FinanceIconBadge icon={item.icon} color={item.color} size="sm" />
              <span className="finance-breakdown-name">{item.label}</span>
              <span className="finance-breakdown-amount">{formatMoney(item.cents, currency)}</span>
              <span className="finance-breakdown-share">{Math.round(share)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
