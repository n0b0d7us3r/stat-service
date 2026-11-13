import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { FinanceBalanceAccountsModal } from './FinanceBalanceAccountsModal';
import { FinanceIconBadge } from './FinanceIconBadge';
import { t } from '../i18n';
import type { FinanceAccount, FinanceBalance, TodayRates } from '../types';
import { crossRate, formatMoney } from '../utils/finance';

export interface AccountBalance {
  key: string;
  name: string;
  icon: string;
  color: string;
  baseCents: number;
  /** Остатки во всех валютах счёта без пересчёта. */
  native: Array<{ currency: string; cents: number }>;
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

/** Остатки по каждому счёту, пересчитанные в основную валюту по курсам на сегодня. */
export function accountBalances(
  accounts: FinanceAccount[],
  balances: FinanceBalance[],
  baseCurrency: string,
  todayRates: TodayRates | null,
  enabledCurrencies: string[],
): AccountBalance[] {
  const enabled = new Set(enabledCurrencies);
  const rows = new Map<string, AccountBalance>();
  for (const account of accounts) {
    rows.set(String(account.id), {
      key: String(account.id),
      name: account.name,
      icon: account.icon,
      color: account.color,
      baseCents: 0,
      native: [],
      foreign: [],
      unconverted: [],
    });
  }

  for (const balance of balances) {
    const key = balance.account_id != null && rows.has(String(balance.account_id)) ? String(balance.account_id) : 'none';
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        ...NO_ACCOUNT,
        name: t('financeNoAccount'),
        baseCents: 0,
        native: [],
        foreign: [],
        unconverted: [],
      });
    }
    const row = rows.get(key)!;
    row.native.push({ currency: balance.currency, cents: balance.cents });
    if (balance.currency === baseCurrency) {
      row.baseCents += balance.cents;
      continue;
    }
    if (!enabled.has(balance.currency)) {
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
  for (const row of list) {
    row.native.sort((a, b) =>
      Number(b.currency === baseCurrency) - Number(a.currency === baseCurrency) || a.currency.localeCompare(b.currency));
  }
  return list;
}

export function FinanceBalanceTotal({ rows, baseCurrency }: { rows: AccountBalance[]; baseCurrency: string }) {
  const total = rows.reduce((sum, row) => sum + row.baseCents, 0);
  const unconverted = rows.flatMap((row) => row.unconverted);

  return (
    <div className={`finance-panel finance-summary-card finance-balance-total ${total < 0 ? 'is-negative' : ''}`}>
      <span className="finance-summary-label">{t('financeCurrentBalance')}</span>
      <span className="finance-summary-value finance-balance-total-value">{signed(total, baseCurrency)}</span>
      {unconverted.length > 0 && (
        <span className="finance-balance-note">{t('financeBalanceUnconverted', { amounts: formatList(unconverted) })}</span>
      )}
    </div>
  );
}

interface FinanceBalanceAccountsProps {
  rows: AccountBalance[];
  baseCurrency: string;
  hiddenAccounts: string[];
  onHiddenAccountsChange: (hidden: string[]) => Promise<void>;
}

export function FinanceBalanceAccounts({
  rows,
  baseCurrency,
  hiddenAccounts,
  onHiddenAccountsChange,
}: FinanceBalanceAccountsProps) {
  const [editing, setEditing] = useState(false);
  const visible = rows.filter((row) => !hiddenAccounts.includes(row.key));

  return (
    <>
      <section className="finance-panel finance-balance-accounts">
        <div className="finance-balance-header">
          <span className="finance-summary-label">{t('financeBalanceByAccount')}</span>
          <button
            type="button"
            className="task-icon-btn task-card-edit finance-balance-edit"
            aria-label={t('financeBalanceEditAccounts')}
            title={t('financeBalanceEditAccounts')}
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} />
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="finance-empty">{t('financeNoAccounts')}</p>
        ) : visible.length === 0 ? (
          <p className="finance-empty">{t('financeBalanceNothingSelected')}</p>
        ) : (
          <ul className="finance-balance-list">
            {visible.map((row) => (
              <li key={row.key} className="finance-balance-row">
                <FinanceIconBadge icon={row.icon} color={row.color} size="sm" />
                <span className="finance-balance-name">{row.name}</span>
                <span
                  className={`finance-balance-amount finance-balance-amount-base ${
                    row.baseCents < 0 ? 'finance-amount-expense' : ''
                  }`}
                >
                  {signed(row.baseCents, baseCurrency)}
                  {row.foreign.length > 0 && (
                    <span className="finance-entry-converted">
                      ({row.foreign.map((item) => signed(item.cents, item.currency)).join(', ')})
                    </span>
                  )}
                </span>
                <span className="finance-balance-amount finance-balance-amount-native">
                  {row.native.length === 0 ? (
                    signed(0, baseCurrency)
                  ) : (
                    row.native.map((item) => (
                      <span key={item.currency} className={item.cents < 0 ? 'finance-amount-expense' : ''}>
                        {signed(item.cents, item.currency)}
                      </span>
                    ))
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <FinanceBalanceAccountsModal
          options={rows}
          hidden={hiddenAccounts}
          onClose={() => setEditing(false)}
          onSave={onHiddenAccountsChange}
        />
      )}
    </>
  );
}
