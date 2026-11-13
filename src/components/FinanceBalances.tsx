import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { FinanceBalanceAccountsModal } from './FinanceBalanceAccountsModal';
import { FinanceIconBadge } from './FinanceIconBadge';
import { t } from '../i18n';
import type { FinanceAccount, FinanceBalance, TodayRates } from '../types';
import { crossRate, crossRateForDisplay, formatMoney } from '../utils/finance';

export interface AccountBalance {
  key: string;
  name: string;
  icon: string;
  color: string;
  baseCents: number;
  /** Остатки во всех валютах счёта без пересчёта. */
  native: Array<{ currency: string; cents: number }>;
  /** Остатки в неосновных валютах, учитываемых в итоге. */
  foreign: Array<{ currency: string; cents: number }>;
  /** Включённые валюты, которые не пересчитаны в итог (нет курса). */
  unconverted: Array<{ currency: string; cents: number }>;
  /** Отключённые валюты: видны на счёте, но не в общем балансе. */
  excluded: Array<{ currency: string; cents: number }>;
}

const NO_ACCOUNT = { name: '', icon: 'list', color: '#8e8e93' };

function formatList(items: Array<{ currency: string; cents: number }>): string {
  return items.map((item) => formatMoney(item.cents, item.currency)).join(', ');
}

function signed(cents: number, currency: string): string {
  return `${cents < 0 ? '−' : ''}${formatMoney(Math.abs(cents), currency)}`;
}

function addCurrencyAmount(
  list: Array<{ currency: string; cents: number }>,
  currency: string,
  cents: number,
): void {
  const item = list.find((entry) => entry.currency === currency);
  if (item) item.cents += cents;
  else list.push({ currency, cents });
}

function mergeCurrencyAmounts(
  items: Array<{ currency: string; cents: number }>,
): Array<{ currency: string; cents: number }> {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.cents);
  }
  return [...totals.entries()].map(([currency, cents]) => ({ currency, cents }));
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
      excluded: [],
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
        excluded: [],
      });
    }
    const row = rows.get(key)!;
    addCurrencyAmount(row.native, balance.currency, balance.cents);
    if (balance.currency === baseCurrency) {
      row.baseCents += balance.cents;
      continue;
    }
    if (!enabled.has(balance.currency)) {
      addCurrencyAmount(row.excluded, balance.currency, balance.cents);
      continue;
    }
    addCurrencyAmount(row.foreign, balance.currency, balance.cents);
    const rate = crossRate(todayRates, balance.currency, baseCurrency);
    if (rate) {
      row.baseCents += Math.round(balance.cents * rate);
    } else {
      addCurrencyAmount(row.unconverted, balance.currency, balance.cents);
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
  todayRates: TodayRates | null;
  hiddenAccounts: string[];
  onHiddenAccountsChange: (hidden: string[]) => Promise<void>;
}

/** Пересчёт всего счёта в основную валюту для отображения (включая отключённые валюты). */
function displayBaseCentsForRow(
  row: AccountBalance,
  baseCurrency: string,
  todayRates: TodayRates | null,
): number {
  let total = 0;
  for (const item of mergeCurrencyAmounts(row.native)) {
    if (item.currency === baseCurrency) {
      total += item.cents;
      continue;
    }
    const rate = crossRateForDisplay(todayRates, item.currency, baseCurrency);
    if (rate) total += Math.round(item.cents * rate);
  }
  return total;
}

function splitAccountAmounts(
  row: AccountBalance,
  baseCurrency: string,
  todayRates: TodayRates | null,
): { main: { currency: string; cents: number }; rest: Array<{ currency: string; cents: number }> } | null {
  const items = mergeCurrencyAmounts(row.native);
  if (items.length === 0) return null;

  const byCode = (a: { currency: string }, b: { currency: string }) => a.currency.localeCompare(b.currency);
  const foreignItems = items.filter((item) => item.currency !== baseCurrency).sort(byCode);
  const baseNative = items.find((item) => item.currency === baseCurrency);
  const displayCents = displayBaseCentsForRow(row, baseCurrency, todayRates);

  const main = (row.excluded.length > 0 || !baseNative) && (foreignItems.length > 0 || baseNative)
    ? { currency: baseCurrency, cents: displayCents }
    : baseNative
      ? { currency: baseCurrency, cents: baseNative.cents }
      : foreignItems.length > 0
        ? { currency: baseCurrency, cents: displayCents }
        : null;

  if (!main) return null;

  return { main, rest: foreignItems };
}

function accountAmounts(row: AccountBalance, baseCurrency: string, todayRates: TodayRates | null) {
  const split = splitAccountAmounts(row, baseCurrency, todayRates);
  const mutedMain = row.excluded.length > 0;

  if (!split) {
    return <span className="finance-balance-amount">{signed(0, baseCurrency)}</span>;
  }

  const { main, rest } = split;

  return (
    <span className={`finance-balance-amount${mutedMain ? ' finance-balance-account-excluded' : ''}`}>
      <span className={main.cents < 0 ? 'finance-amount-expense' : undefined}>
        {signed(main.cents, main.currency)}
      </span>
      {rest.length > 0 && (
        <span className="finance-balance-amount-extra">
          (
          {rest.map((item, index) => (
            <span key={item.currency}>
              {index > 0 ? ', ' : ''}
              <span className={item.cents < 0 ? 'finance-amount-expense' : undefined}>
                {signed(item.cents, item.currency)}
              </span>
            </span>
          ))}
          )
        </span>
      )}
    </span>
  );
}

export function FinanceBalanceAccounts({
  rows,
  baseCurrency,
  todayRates,
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
                {accountAmounts(row, baseCurrency, todayRates)}
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
