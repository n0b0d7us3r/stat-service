import { FinanceIconBadge } from './FinanceIconBadge';
import type { FinanceDonutItem } from './FinanceDonutChart';
import { formatMoney } from '../utils/finance';

interface FinanceTopListProps {
  items: FinanceDonutItem[];
  currency: string;
  emptyText: string;
  limit?: number;
}

export function FinanceTopList({ items, currency, emptyText, limit = 5 }: FinanceTopListProps) {
  if (items.length === 0) {
    return <p className="finance-empty">{emptyText}</p>;
  }

  const top = items.slice(0, limit);
  const max = top[0].cents;

  return (
    <ol className="finance-top">
      {top.map((item, index) => (
        <li key={item.key} className="finance-top-item">
          <span className="finance-top-rank">{index + 1}</span>
          <FinanceIconBadge icon={item.icon} color={item.color} size="sm" />
          <div className="finance-top-body">
            <div className="finance-top-head">
              <span className="finance-top-name">{item.label}</span>
              <span className="finance-top-amount">{formatMoney(item.cents, currency)}</span>
            </div>
            <span className="finance-top-track">
              <span style={{ width: `${max > 0 ? (item.cents / max) * 100 : 0}%`, backgroundColor: item.color }} />
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
