import { formatAmountCompact, formatMoney, type FinanceBucket } from '../utils/finance';

export interface FinanceChartSegment {
  key: string;
  label: string;
  color: string;
  cents: number;
}

export interface FinanceChartColumn extends FinanceBucket {
  segments: FinanceChartSegment[];
}

interface FinanceMonthChartProps {
  columns: FinanceChartColumn[];
  currency: string;
}

function columnTotal(column: FinanceChartColumn): number {
  return column.segments.reduce((sum, segment) => sum + segment.cents, 0);
}

export function FinanceMonthChart({ columns, currency }: FinanceMonthChartProps) {
  const max = Math.max(...columns.map(columnTotal), 0);
  const labelStep = Math.max(1, Math.ceil(columns.length / 12));
  const showValues = columns.length <= 12;

  return (
    <div
      className="finance-chart-bars"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map((column, index) => {
        const total = columnTotal(column);
        const tooltip = [
          `${column.title}: ${formatMoney(total, currency)}`,
          ...(column.segments.length > 1
            ? column.segments.map((segment) => `${segment.label}: ${formatMoney(segment.cents, currency)}`)
            : []),
        ].join('\n');

        return (
          <div key={column.key} className="finance-chart-column" title={tooltip}>
            {showValues && (
              <span className="finance-chart-value">{total > 0 ? formatAmountCompact(total) : ''}</span>
            )}
            <span className="finance-chart-track">
              <span className="finance-chart-bar" style={{ height: max > 0 ? `${(total / max) * 100}%` : 0 }}>
                {column.segments.map((segment) => (
                  <span
                    key={segment.key}
                    className="finance-chart-segment"
                    style={{ flexGrow: segment.cents, backgroundColor: segment.color }}
                  />
                ))}
              </span>
            </span>
            <span className="finance-chart-label">{index % labelStep === 0 ? column.label : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
