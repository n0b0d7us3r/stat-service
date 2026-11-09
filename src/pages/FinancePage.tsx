import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarRange, CreditCard, Layers, Minus, Plus } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { FinanceCategoryModal, type FinanceCollectionMode } from '../components/FinanceCategoryModal';
import { FinanceEntryModal } from '../components/FinanceEntryModal';
import { FinanceEntryDetailsModal } from '../components/FinanceEntryDetailsModal';
import { FinancePeriodModal } from '../components/FinancePeriodModal';
import { FinanceDonutChart, type FinanceDonutItem } from '../components/FinanceDonutChart';
import { FinanceMonthChart, type FinanceChartColumn } from '../components/FinanceMonthChart';
import { FinanceCompareChart, type FinanceCompareColumn } from '../components/FinanceCompareChart';
import { FinanceTopList } from '../components/FinanceTopList';
import { FinanceIconBadge } from '../components/FinanceIconBadge';
import { FinanceTransferModal } from '../components/FinanceTransferModal';
import { FinanceBalanceAccounts, FinanceBalanceTotal, accountBalances } from '../components/FinanceBalances';
import {
  FinanceTransferDetailsModal,
  TRANSFER_COLOR,
  transferListAmount,
} from '../components/FinanceTransferDetailsModal';
import { SortSelect } from '../components/SortSelect';
import { ApiError } from '../api/client';
import {
  deleteFinanceEntry,
  deleteFinanceTransfer,
  getFinanceBalances,
  getFinanceOverview,
} from '../api/finance';
import { updateUserSettings } from '../api/settings';
import { APP_NAME } from '../config/app';
import { dateLocaleTag, t } from '../i18n';
import type {
  FinanceAccount,
  FinanceBalance,
  FinanceCategory,
  FinanceEntry,
  FinanceEntryKind,
  FinanceTransfer,
  TodayRates,
} from '../types';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatPeriod,
  monthPeriod,
  periodBuckets,
  toBaseCents,
  type FinancePeriod,
} from '../utils/finance';
import { TRANSFER_ICON } from '../utils/financeIcons';
import '../styles/TasksPage.css';
import '../styles/components/TaskArchiveModal.css';
import '../styles/FinancePage.css';

type FinanceTab = 'all' | FinanceEntryKind;

const TABS: FinanceTab[] = ['all', 'expense', 'income'];
const UNCATEGORIZED = { key: 'none', color: '#8e8e93', icon: 'list' };

function sumCents(entries: FinanceEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount_cents, 0);
}

type ListItem =
  | { type: 'entry'; item: FinanceEntry }
  | { type: 'transfer'; item: FinanceTransfer };

function formatEntryDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString(dateLocaleTag, { day: 'numeric', month: 'short', year: 'numeric' });
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, dateLocaleTag));
}

export function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>('all');
  const [period, setPeriod] = useState<FinancePeriod>(() => monthPeriod(new Date()));
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [editingSelected, setEditingSelected] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');
  const [todayRates, setTodayRates] = useState<TodayRates | null>(null);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [entryKind, setEntryKind] = useState<FinanceEntryKind | null>(null);
  const [manageMode, setManageMode] = useState<FinanceCollectionMode | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [transfers, setTransfers] = useState<FinanceTransfer[]>([]);
  const [balances, setBalances] = useState<FinanceBalance[]>([]);
  const [hiddenBalanceAccounts, setHiddenBalanceAccounts] = useState<string[]>([]);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);
  const [editingTransfer, setEditingTransfer] = useState(false);
  const [deletingTransferId, setDeletingTransferId] = useState<number | null>(null);

  const loadPeriod = useCallback(async (target: FinancePeriod) => {
    try {
      const overview = await getFinanceOverview(target.from, target.to);
      setCategories(overview.categories);
      setAccounts(overview.accounts);
      setCurrency(overview.baseCurrency);
      setTodayRates(overview.todayRates);
      setEntries(overview.entries);
      setTransfers(overview.transfers);
      setBalances(overview.balances);
      setHiddenBalanceAccounts(overview.hiddenBalanceAccounts);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeLoadFailed'));
    } finally {
      setLoaded(true);
    }
  }, []);

  const refreshBalances = useCallback(async () => {
    try {
      const next = await getFinanceBalances();
      setBalances(next.balances);
      setTodayRates(next.rates);
    } catch {
      /* баланс обновится при следующей загрузке страницы */
    }
  }, []);

  const saveHiddenBalanceAccounts = useCallback(async (hidden: string[]) => {
    const settings = await updateUserSettings({ hiddenBalanceAccounts: hidden });
    setHiddenBalanceAccounts(settings.hiddenBalanceAccounts);
  }, []);

  useEffect(() => {
    document.title = `${t('financeTitle')} | ${APP_NAME}`;
  }, []);

  useEffect(() => {
    void loadPeriod(period);
  }, [loadPeriod, period]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
  const selectedTransfer = transfers.find((transfer) => transfer.id === selectedTransferId);

  const categoryOf = useCallback((entry: FinanceEntry) => {
    const category = entry.category_id != null ? categoryById.get(entry.category_id) : undefined;
    if (!category) {
      return {
        ...UNCATEGORIZED,
        label: entry.kind === 'expense' ? t('financeUncategorized') : t('financeNoSource'),
      };
    }
    return { key: String(category.id), label: category.name, color: category.color, icon: category.icon };
  }, [categoryById]);

  const groupByCategory = useCallback((list: FinanceEntry[]): FinanceDonutItem[] => {
    const groups = new Map<string, FinanceDonutItem>();
    for (const entry of list) {
      const category = categoryOf(entry);
      const group = groups.get(category.key) ?? { ...category, cents: 0 };
      group.cents += entry.amount_cents;
      groups.set(category.key, group);
    }
    return [...groups.values()].sort((a, b) => b.cents - a.cents);
  }, [categoryOf]);

  const accountFilterValue = accountFilter !== 'all' && accountById.has(Number(accountFilter))
    ? accountFilter
    : 'all';
  const accountEntries = useMemo(
    () => (accountFilterValue === 'all'
      ? entries
      : entries.filter((entry) => entry.account_id === Number(accountFilterValue))),
    [accountFilterValue, entries],
  );
  const accountOptions = useMemo(
    () => [
      { value: 'all', label: t('financeAllAccounts') },
      ...sortByName(accounts).map((account) => ({ value: String(account.id), label: account.name })),
    ],
    [accounts],
  );

  const { inCurrency, unconvertedCount } = useMemo(() => {
    const converted: FinanceEntry[] = [];
    let skipped = 0;
    for (const entry of accountEntries) {
      const cents = toBaseCents(entry, currency, todayRates);
      if (cents === null) {
        skipped += 1;
      } else {
        converted.push({ ...entry, amount_cents: cents });
      }
    }
    return { inCurrency: converted, unconvertedCount: skipped };
  }, [accountEntries, currency, todayRates]);
  const incomeInCurrency = useMemo(() => inCurrency.filter((entry) => entry.kind === 'income'), [inCurrency]);
  const expenseInCurrency = useMemo(() => inCurrency.filter((entry) => entry.kind === 'expense'), [inCurrency]);

  const balanceRows = useMemo(
    () => accountBalances(accounts, balances, currency, todayRates),
    [accounts, balances, currency, todayRates],
  );

  const totals = useMemo(() => {
    const income = sumCents(incomeInCurrency);
    const expense = sumCents(expenseInCurrency);
    return { income, expense, balance: income - expense };
  }, [expenseInCurrency, incomeInCurrency]);

  const incomeGroups = useMemo(() => groupByCategory(incomeInCurrency), [groupByCategory, incomeInCurrency]);
  const expenseGroups = useMemo(() => groupByCategory(expenseInCurrency), [expenseInCurrency, groupByCategory]);

  const { buckets, keyOf } = useMemo(() => periodBuckets(period), [period]);

  const kindColumns: FinanceChartColumn[] = useMemo(() => {
    if (tab === 'all') return [];
    const source = tab === 'expense' ? expenseInCurrency : incomeInCurrency;
    const byBucket = new Map<string, FinanceEntry[]>();
    for (const entry of source) {
      const key = keyOf(entry.date);
      byBucket.set(key, [...(byBucket.get(key) ?? []), entry]);
    }
    return buckets.map((bucket) => ({ ...bucket, segments: groupByCategory(byBucket.get(bucket.key) ?? []) }));
  }, [buckets, expenseInCurrency, groupByCategory, incomeInCurrency, keyOf, tab]);

  const compareColumns: FinanceCompareColumn[] = useMemo(() => {
    const totalsByBucket = new Map<string, { income: number; expense: number }>();
    for (const entry of inCurrency) {
      const key = keyOf(entry.date);
      const bucket = totalsByBucket.get(key) ?? { income: 0, expense: 0 };
      bucket[entry.kind] += entry.amount_cents;
      totalsByBucket.set(key, bucket);
    }
    return buckets.map((bucket) => ({ ...bucket, ...(totalsByBucket.get(bucket.key) ?? { income: 0, expense: 0 }) }));
  }, [buckets, inCurrency, keyOf]);

  const listItems = useMemo(() => {
    const items: ListItem[] = (tab === 'all' ? accountEntries : accountEntries.filter((entry) => entry.kind === tab))
      .map((entry) => ({ type: 'entry', item: entry }));
    if (tab === 'all') {
      const accountId = accountFilterValue === 'all' ? null : Number(accountFilterValue);
      for (const transfer of transfers) {
        if (accountId === null || transfer.from_account_id === accountId || transfer.to_account_id === accountId) {
          items.push({ type: 'transfer', item: transfer });
        }
      }
    }
    return items.sort((a, b) => (
      b.item.date.localeCompare(a.item.date) || b.item.created_at.localeCompare(a.item.created_at)
    ));
  }, [accountEntries, accountFilterValue, tab, transfers]);

  const defaultEntryDate = (() => {
    const todayKey = formatLocalDate(new Date());
    if (todayKey >= period.from && todayKey <= period.to) return todayKey;
    return period.to < todayKey ? period.to : period.from;
  })();

  const handleEntrySaved = (entry: FinanceEntry) => {
    setEntryKind(null);
    void refreshBalances();
    if (entry.date < period.from || entry.date > period.to) return;
    setEntries((current) => [entry, ...current].sort((a, b) => (
      b.date.localeCompare(a.date) || b.id - a.id
    )));
  };

  const handleEntryUpdated = (entry: FinanceEntry) => {
    setEditingSelected(false);
    void refreshBalances();
    const inPeriod = entry.date >= period.from && entry.date <= period.to;
    if (!inPeriod) setSelectedEntryId(null);
    setEntries((current) => {
      const rest = current.filter((item) => item.id !== entry.id);
      if (!inPeriod) return rest;
      return [entry, ...rest].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    });
  };

  const closeSelectedEntry = () => {
    setSelectedEntryId(null);
    setEditingSelected(false);
  };

  const handleDeleteEntry = async (entry: FinanceEntry) => {
    setDeletingEntryId(entry.id);
    try {
      await deleteFinanceEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setSelectedEntryId(null);
      void refreshBalances();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeDeleteEntryFailed'));
    } finally {
      setDeletingEntryId(null);
    }
  };

  const handleTransferSaved = (transfer: FinanceTransfer) => {
    setTransferModalOpen(false);
    setEditingTransfer(false);
    void refreshBalances();
    const inPeriod = transfer.date >= period.from && transfer.date <= period.to;
    if (!inPeriod) setSelectedTransferId(null);
    setTransfers((current) => {
      const rest = current.filter((item) => item.id !== transfer.id);
      return inPeriod ? [transfer, ...rest] : rest;
    });
  };

  const closeSelectedTransfer = () => {
    setSelectedTransferId(null);
    setEditingTransfer(false);
  };

  const handleDeleteTransfer = async (transfer: FinanceTransfer) => {
    setDeletingTransferId(transfer.id);
    try {
      await deleteFinanceTransfer(transfer.id);
      setTransfers((current) => current.filter((item) => item.id !== transfer.id));
      setSelectedTransferId(null);
      void refreshBalances();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeDeleteTransferFailed'));
    } finally {
      setDeletingTransferId(null);
    }
  };

  const handleCollectionCreated = (item: FinanceCategory | FinanceAccount) => {
    if ('kind' in item) {
      setCategories((current) => sortByName([...current, item]));
    } else {
      setAccounts((current) => sortByName([...current, item]));
    }
  };

  const handleCollectionDeleted = (itemId: number) => {
    if (manageMode === 'account') {
      setAccounts((current) => current.filter((account) => account.id !== itemId));
      setEntries((current) => current.map((entry) => (
        entry.account_id === itemId ? { ...entry, account_id: null } : entry
      )));
      void refreshBalances();
      setTransfers((current) => current.map((transfer) => ({
        ...transfer,
        from_account_id: transfer.from_account_id === itemId ? null : transfer.from_account_id,
        to_account_id: transfer.to_account_id === itemId ? null : transfer.to_account_id,
      })));
      return;
    }
    setCategories((current) => current.filter((category) => category.id !== itemId));
    setEntries((current) => current.map((entry) => (
      entry.category_id === itemId ? { ...entry, category_id: null } : entry
    )));
  };

  const tabLabel = (value: FinanceTab) => (
    value === 'all' ? t('financeAll') : value === 'expense' ? t('financeExpenses') : t('financeIncome')
  );

  const balanceStatus = totals.balance > 0
    ? t('financeInPlus')
    : totals.balance < 0
      ? t('financeInMinus')
      : t('financeEven');

  return (
    <Layout>
      <div className="finance-page">
        <div className="finance-page-intro">
          <PageTitle title={t('financeTitle')} />
          {loaded && (
            <div className="finance-balance-intro-mobile">
              <FinanceBalanceTotal rows={balanceRows} baseCurrency={currency} />
            </div>
          )}

          <div className="finance-toolbar">
            <SortSelect<FinanceTab>
              label={t('financeShow')}
              value={tab}
              options={TABS.map((value) => ({ value, label: tabLabel(value) }))}
              onChange={setTab}
            />

            {accounts.length > 0 && (
              <SortSelect
                label={t('financeAccount')}
                value={accountFilterValue}
                options={accountOptions}
                onChange={setAccountFilter}
              />
            )}

            <button type="button" className="finance-period-btn" onClick={() => setPeriodOpen(true)}>
              <CalendarRange size={18} strokeWidth={2.25} />
              <span>{formatPeriod(period)}</span>
            </button>

          </div>

          <div className="finance-controls">
            {tab !== 'expense' && (
              <button
                type="button"
                className="finance-add-btn finance-add-btn-income"
                onClick={() => setEntryKind('income')}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>{t('financeAddIncome')}</span>
              </button>
            )}
            {tab !== 'income' && (
              <button
                type="button"
                className="finance-add-btn finance-add-btn-expense"
                onClick={() => setEntryKind('expense')}
              >
                <Minus size={18} strokeWidth={2.5} />
                <span>{t('financeAddExpense')}</span>
              </button>
            )}
            <button
              type="button"
              className="finance-add-btn finance-add-btn-transfer"
              onClick={() => setTransferModalOpen(true)}
            >
              <ArrowLeftRight size={18} strokeWidth={2.5} />
              <span>{t('financeTransfer')}</span>
            </button>
            {tab !== 'all' && (
              <button type="button" className="tasks-tag-create-btn finance-manage-btn" onClick={() => setManageMode(tab)}>
                <Layers size={18} strokeWidth={2.25} />
                <span>{tab === 'expense' ? t('financeCategories') : t('financeSources')}</span>
              </button>
            )}
            <button
              type="button"
              className="tasks-tag-create-btn finance-manage-btn"
              onClick={() => setManageMode('account')}
            >
              <CreditCard size={18} strokeWidth={2.25} />
              <span>{t('financeAccounts')}</span>
            </button>
          </div>
        </div>

        {error && <p className="tasks-error">{error}</p>}

        {!loaded ? (
          <p className="tasks-placeholder">{t('financeLoading')}</p>
        ) : (
          <>
            {tab === 'all' ? (
              <>
                <div className="finance-summary finance-summary-with-balance">
                  <FinanceBalanceTotal rows={balanceRows} baseCurrency={currency} />
                  <div
                    className={`finance-panel finance-summary-card finance-result ${
                      totals.balance < 0 ? 'is-negative' : totals.balance > 0 ? 'is-positive' : ''
                    }`}
                  >
                    <span className="finance-summary-label">{t('financeResult')}</span>
                    <span className="finance-summary-value finance-result-value">
                      {totals.balance > 0 ? '+' : totals.balance < 0 ? '−' : ''}
                      {formatMoney(Math.abs(totals.balance), currency)}
                    </span>
                    <span className="finance-result-status">{balanceStatus}</span>
                  </div>
                  <div className="finance-panel finance-summary-card">
                    <span className="finance-summary-label">{t('financeIncome')}</span>
                    <span className="finance-summary-value finance-amount-income">
                      {formatMoney(totals.income, currency)}
                    </span>
                  </div>
                  <div className="finance-panel finance-summary-card">
                    <span className="finance-summary-label">{t('financeExpenses')}</span>
                    <span className="finance-summary-value finance-amount-expense">
                      {formatMoney(totals.expense, currency)}
                    </span>
                  </div>
                  <FinanceBalanceAccounts
                    rows={balanceRows}
                    baseCurrency={currency}
                    hiddenAccounts={hiddenBalanceAccounts}
                    onHiddenAccountsChange={saveHiddenBalanceAccounts}
                  />
                </div>

                <section className="finance-panel">
                  <h2 className="finance-panel-title">{t('financeIncomeVsExpenses')}</h2>
                  <FinanceCompareChart columns={compareColumns} currency={currency} />
                </section>

                <div className="finance-charts">
                  <section className="finance-panel">
                    <h2 className="finance-panel-title">{t('financeTopExpenses')}</h2>
                    <FinanceTopList items={expenseGroups} currency={currency} emptyText={t('financeNoExpenses')} />
                  </section>
                  <section className="finance-panel">
                    <h2 className="finance-panel-title">{t('financeTopIncome')}</h2>
                    <FinanceTopList items={incomeGroups} currency={currency} emptyText={t('financeNoIncome')} />
                  </section>
                </div>
              </>
            ) : (
              <div className="finance-charts">
                <section className="finance-panel">
                  <h2 className="finance-panel-title">
                    {tab === 'expense' ? t('financeExpensesByCategory') : t('financeIncomeBySource')}
                  </h2>
                  {(tab === 'expense' ? expenseGroups : incomeGroups).length === 0 ? (
                    <p className="finance-empty">
                      {tab === 'expense' ? t('financeNoExpenses') : t('financeNoIncome')}
                    </p>
                  ) : (
                    <FinanceDonutChart
                      items={tab === 'expense' ? expenseGroups : incomeGroups}
                      currency={currency}
                      totalLabel={tabLabel(tab)}
                    />
                  )}
                </section>

                <section className="finance-panel">
                  <h2 className="finance-panel-title">
                    {tab === 'expense' ? t('financeExpensesDynamics') : t('financeIncomeDynamics')}
                  </h2>
                  <FinanceMonthChart columns={kindColumns} currency={currency} />
                </section>
              </div>
            )}

            <section className="finance-panel">
              <h2 className="finance-panel-title">{t('financeEntriesTitle')}</h2>
              {unconvertedCount > 0 && (
                <p className="finance-warning">
                  {t('financeUnconverted', { count: unconvertedCount, currency })}
                </p>
              )}
              {listItems.length === 0 ? (
                <p className="finance-empty">{t('financeNoEntries')}</p>
              ) : (
                <ul className="finance-entries">
                  {listItems.map((listItem) => {
                    if (listItem.type === 'transfer') {
                      const transfer = listItem.item;
                      const from = transfer.from_account_id != null ? accountById.get(transfer.from_account_id) : undefined;
                      const to = transfer.to_account_id != null ? accountById.get(transfer.to_account_id) : undefined;
                      const accountId = accountFilterValue === 'all' ? null : Number(accountFilterValue);
                      const transferAmount = transferListAmount(transfer, accountId);
                      const meta = [
                        formatEntryDate(transfer.date),
                        `${from?.name ?? t('financeNoAccount')} → ${to?.name ?? t('financeNoAccount')}`,
                        transfer.note,
                      ].filter(Boolean).join(' · ');
                      return (
                        <li key={`transfer-${transfer.id}`}>
                          <button
                            type="button"
                            className="finance-entry"
                            onClick={() => setSelectedTransferId(transfer.id)}
                          >
                            <FinanceIconBadge icon={TRANSFER_ICON} color={TRANSFER_COLOR} />
                            <span className="finance-entry-body">
                              <span className="finance-entry-title">{t('financeTransferOne')}</span>
                              <span className="finance-entry-meta">{meta}</span>
                            </span>
                            <span
                              className={`finance-entry-amount ${
                                transferAmount.kind === 'income'
                                  ? 'finance-amount-income'
                                  : transferAmount.kind === 'expense'
                                    ? 'finance-amount-expense'
                                    : ''
                              }`}
                            >
                              {transferAmount.text}
                            </span>
                          </button>
                        </li>
                      );
                    }

                    const entry = listItem.item;
                    const category = categoryOf(entry);
                    const account = entry.account_id != null ? accountById.get(entry.account_id) : undefined;
                    const amount = formatMoney(entry.amount_cents, entry.currency);
                    const meta = [formatEntryDate(entry.date), account?.name, entry.note].filter(Boolean).join(' · ');
                    return (
                      <li key={`entry-${entry.id}`}>
                        <button
                          type="button"
                          className="finance-entry"
                          onClick={() => setSelectedEntryId(entry.id)}
                        >
                          <FinanceIconBadge icon={category.icon} color={category.color} />
                          <span className="finance-entry-body">
                            <span className="finance-entry-title">{category.label}</span>
                            <span className="finance-entry-meta">{meta}</span>
                          </span>
                          <span
                            className={`finance-entry-amount ${
                              entry.kind === 'income' ? 'finance-amount-income' : 'finance-amount-expense'
                            }`}
                          >
                            {entry.kind === 'income' ? '+' : '−'}{amount}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {entryKind && (
        <FinanceEntryModal
          kind={entryKind}
          categories={categories.filter((category) => category.kind === entryKind)}
          accounts={accounts}
          baseCurrency={currency}
          todayRates={todayRates}
          defaultDate={defaultEntryDate}
          onClose={() => setEntryKind(null)}
          onSaved={handleEntrySaved}
          onManage={(mode) => {
            setEntryKind(null);
            setManageMode(mode);
          }}
        />
      )}

      {manageMode && (
        <FinanceCategoryModal
          key={manageMode}
          mode={manageMode}
          items={manageMode === 'account'
            ? accounts
            : categories.filter((category) => category.kind === manageMode)}
          onClose={() => setManageMode(null)}
          onCreated={handleCollectionCreated}
          onDeleted={handleCollectionDeleted}
        />
      )}

      {transferModalOpen && (
        <FinanceTransferModal
          accounts={accounts}
          baseCurrency={currency}
          defaultDate={defaultEntryDate}
          onClose={() => setTransferModalOpen(false)}
          onSaved={handleTransferSaved}
          onManageAccounts={() => {
            setTransferModalOpen(false);
            setManageMode('account');
          }}
        />
      )}

      {selectedTransfer && (editingTransfer ? (
        <FinanceTransferModal
          accounts={accounts}
          baseCurrency={currency}
          defaultDate={selectedTransfer.date}
          transfer={selectedTransfer}
          onClose={() => setEditingTransfer(false)}
          onSaved={handleTransferSaved}
          onManageAccounts={() => {
            closeSelectedTransfer();
            setManageMode('account');
          }}
        />
      ) : (
        <FinanceTransferDetailsModal
          transfer={selectedTransfer}
          fromAccount={selectedTransfer.from_account_id != null ? accountById.get(selectedTransfer.from_account_id) : undefined}
          toAccount={selectedTransfer.to_account_id != null ? accountById.get(selectedTransfer.to_account_id) : undefined}
          deleting={deletingTransferId === selectedTransfer.id}
          onClose={closeSelectedTransfer}
          onEdit={() => setEditingTransfer(true)}
          onDelete={() => void handleDeleteTransfer(selectedTransfer)}
        />
      ))}

      {selectedEntry && (editingSelected ? (
        <FinanceEntryModal
          kind={selectedEntry.kind}
          categories={categories.filter((category) => category.kind === selectedEntry.kind)}
          accounts={accounts}
          baseCurrency={currency}
          todayRates={todayRates}
          defaultDate={selectedEntry.date}
          entry={selectedEntry}
          onClose={() => setEditingSelected(false)}
          onSaved={handleEntryUpdated}
          onManage={(mode) => {
            closeSelectedEntry();
            setManageMode(mode);
          }}
        />
      ) : (
        <FinanceEntryDetailsModal
          entry={selectedEntry}
          category={categoryOf(selectedEntry)}
          account={selectedEntry.account_id != null ? accountById.get(selectedEntry.account_id) : undefined}
          baseCurrency={currency}
          todayRates={todayRates}
          deleting={deletingEntryId === selectedEntry.id}
          onClose={closeSelectedEntry}
          onEdit={() => setEditingSelected(true)}
          onDelete={() => void handleDeleteEntry(selectedEntry)}
        />
      ))}

      {periodOpen && (
        <FinancePeriodModal
          period={period}
          onClose={() => setPeriodOpen(false)}
          onApply={(next) => {
            setPeriodOpen(false);
            setPeriod(next);
          }}
        />
      )}
    </Layout>
  );
}
