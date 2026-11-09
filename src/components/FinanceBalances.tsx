import { FinanceIconBadge } from './FinanceIconBadge';
import { t } from '../i18n';
import type { FinanceAccount, FinanceBalance, TodayRates } from '../types';
import { crossRate, formatMoney } from '../utils/finance';

interface FinanceBalancesProps {
  accounts: FinanceAccount[];
  balances: FinanceBalance[];
  baseCurrency: string;
  todayRates: TodayRates | null;
}

interface AccountBalance {
  key: string;
  name: string;
  icon: string;
  color: string;
  baseCents: number;
  /** Остатки в неосновных валютах. */
  foreign: Array<{ currency: string; cents: number }>;
  /** Остатки, которые не удалось пересчитать: нет курса. */
  unconverted: Array<{ currency: string; cents: number }>;
}

const NO_ACCOUNT = { name: '', icon: 'list', color: '#8e8e93' };

function formatList(items: Array<{ currency: string; cents: number }>): string {
  return items.map((item) => formatMoney(item.cents, item.currency)).join(', ');
}

function signed(cents: number, currency: string): string {
  return `${cents < 0 ? '−' : ''}${formatMoney(Math.abs(cents), currency)}`;
}

export function FinanceBalances({ accounts, balances, baseCurrency, todayRates }: FinanceBalancesProps) {
  const rows = new Map<string, AccountBalance>();
  for (const account of accounts) {
    rows.set(String(account.id), {
      key: String(account.id),
      name: account.name,
      icon: account.icon,
      color: account.color,
      baseCents: 0,
      foreign: [],
      unconverted: [],
    });
  }

  for (const balance of balances) {
    const key = balance.account_id != null && rows.has(String(balance.account_id)) ? String(balance.account_id) : 'none';
    if (!rows.has(key)) {
      rows.set(key, { key, ...NO_ACCOUNT, name: t('financeNoAccount'), baseCents: 0, foreign: [], unconverted: [] });
    }
    const row = rows.get(key)!;
    if (balance.currency === baseCurrency) {
      row.baseCents += balance.cents;
      continue;
    }
    row.foreign.push({ currency: balance.currency, cents: balance.cents });
    const rate = crossRate(todayRates, balance.currency, baseCurrency);
    if (rate) {
      row.baseCents += Math.round(balance.cents * rate);
    } else {
      row.unconverted.push({ currency: balance.currency, cents: balance.cents });
    }
  }

  const list = [...rows.values()];
  const total = list.reduce((sum, row) => sum + row.baseCents, 0);
  const unconverted = list.flatMap((row) => row.unconverted);

  return (
    <div className="finance-balances">
      <section className={`finance-panel finance-balance-total ${total < 0 ? 'is-negative' : ''}`}>
        <span className="finance-summary-label">{t('financeCurrentBalance')}</span>
        <span className="finance-summary-value finance-balance-total-value">{signed(total, baseCurrency)}</span>
        {unconverted.length > 0 && (
          <span className="finance-balance-note">{t('financeBalanceUnconverted', { amounts: formatList(unconverted) })}</span>
        )}
      </section>

      <section className="finance-panel finance-balance-accounts">
        <span className="finance-summary-label">{t('financeBalanceByAccount')}</span>
        {list.length === 0 ? (
          <p className="finance-empty">{t('financeNoAccounts')}</p>
        ) : (
          <ul className="finance-balance-list">
            {list.map((row) => (
              <li key={row.key} className="finance-balance-row">
                <FinanceIconBadge icon={row.icon} color={row.color} size="sm" />
                <span className="finance-balance-name">{row.name}</span>
                <span className={`finance-balance-amount ${row.baseCents < 0 ? 'finance-amount-expense' : ''}`}>
                  {signed(row.baseCents, baseCurrency)}
                  {row.foreign.length > 0 && (
                    <span className="finance-entry-converted">
                      ({row.foreign.map((item) => signed(item.cents, item.currency)).join(', ')})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
