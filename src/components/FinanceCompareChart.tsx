import { t } from '../i18n';
import { formatMoney, type FinanceBucket } from '../utils/finance';

export interface FinanceCompareColumn extends FinanceBucket {
  income: number;
  expense: number;
}

interface FinanceCompareChartProps {
  columns: FinanceCompareColumn[];
  currency: string;
}

export function FinanceCompareChart({ columns, currency }: FinanceCompareChartProps) {
  const max = Math.max(...columns.flatMap((column) => [column.income, column.expense]), 0);
  const labelStep = Math.max(1, Math.ceil(columns.length / 12));
  const heightOf = (cents: number) => (max > 0 ? `${(cents / max) * 100}%` : 0);

  return (
    <div className="finance-compare">
      <div className="finance-compare-legend">
        <span><i className="finance-legend-swatch finance-legend-income" />{t('financeIncome')}</span>
        <span><i className="finance-legend-swatch finance-legend-expense" />{t('financeExpenses')}</span>
      </div>
      <div
        className="finance-chart-bars"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column, index) => {
          const net = column.income - column.expense;
          const tooltip = [
            column.title,
            `${t('financeIncome')}: ${formatMoney(column.income, currency)}`,
            `${t('financeExpenses')}: ${formatMoney(column.expense, currency)}`,
            `${t('financeBalance')}: ${net < 0 ? '−' : '+'}${formatMoney(Math.abs(net), currency)}`,
          ].join('\n');

          return (
            <div key={column.key} className="finance-chart-column" title={tooltip}>
              <span className="finance-chart-track">
                <span className="finance-compare-pair">
                  <span className="finance-compare-bar finance-legend-income" style={{ height: heightOf(column.income) }} />
                  <span className="finance-compare-bar finance-legend-expense" style={{ height: heightOf(column.expense) }} />
                </span>
              </span>
              <span className="finance-chart-label">{index % labelStep === 0 ? column.label : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
