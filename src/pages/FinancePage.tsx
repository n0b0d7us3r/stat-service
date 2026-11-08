import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, Layers, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { FinanceCategoryModal } from '../components/FinanceCategoryModal';
import { FinanceEntryModal } from '../components/FinanceEntryModal';
import { FinancePeriodModal } from '../components/FinancePeriodModal';
import { FinanceDonutChart, type FinanceDonutItem } from '../components/FinanceDonutChart';
import { FinanceMonthChart, type FinanceChartColumn } from '../components/FinanceMonthChart';
import { FinanceIconBadge } from '../components/FinanceIconBadge';
import { ApiError } from '../api/client';
import { deleteFinanceEntry, getFinanceOverview } from '../api/finance';
import { APP_NAME } from '../config/app';
import { dateLocaleTag, t } from '../i18n';
import type { FinanceCategory, FinanceEntry, FinanceEntryKind } from '../types';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatPeriod,
  monthPeriod,
  periodBuckets,
  type FinancePeriod,
} from '../utils/finance';
import '../styles/TasksPage.css';
import '../styles/components/TaskArchiveModal.css';
import '../styles/FinancePage.css';

const UNCATEGORIZED = { key: 'none', color: '#8e8e93', icon: 'list' };

function sumCents(entries: FinanceEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount_cents, 0);
}

export function FinancePage() {
  const [tab, setTab] = useState<FinanceEntryKind>('expense');
  const [period, setPeriod] = useState<FinancePeriod>(() => monthPeriod(new Date()));
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  const loadPeriod = useCallback(async (target: FinancePeriod) => {
    try {
      const overview = await getFinanceOverview(target.from, target.to);
      setCategories(overview.categories);
      setEntries(overview.entries);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeLoadFailed'));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    document.title = `${t('financeTitle')} | ${APP_NAME}`;
  }, []);

  useEffect(() => {
    void loadPeriod(period);
  }, [loadPeriod, period]);

  const isExpense = tab === 'expense';
  const tabCategories = useMemo(() => categories.filter((category) => category.kind === tab), [categories, tab]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

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

  const tabEntries = useMemo(() => entries.filter((entry) => entry.kind === tab), [entries, tab]);

  const currencyOptions = useMemo(() => {
    const codes = new Set([DEFAULT_CURRENCY, ...entries.map((entry) => entry.currency)]);
    return [...codes];
  }, [entries]);

  const currencyEntries = useMemo(
    () => tabEntries.filter((entry) => entry.currency === currency),
    [currency, tabEntries],
  );

  const totals = useMemo(() => {
    const inCurrency = entries.filter((entry) => entry.currency === currency);
    const income = sumCents(inCurrency.filter((entry) => entry.kind === 'income'));
    const expense = sumCents(inCurrency.filter((entry) => entry.kind === 'expense'));
    return { income, expense, balance: income - expense };
  }, [currency, entries]);

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

  const donutItems = useMemo(() => groupByCategory(currencyEntries), [currencyEntries, groupByCategory]);

  const chartColumns: FinanceChartColumn[] = useMemo(() => {
    const { buckets, keyOf } = periodBuckets(period);
    const byBucket = new Map<string, FinanceEntry[]>();
    for (const entry of currencyEntries) {
      const key = keyOf(entry.date);
      byBucket.set(key, [...(byBucket.get(key) ?? []), entry]);
    }
    return buckets.map((bucket) => ({ ...bucket, segments: groupByCategory(byBucket.get(bucket.key) ?? []) }));
  }, [currencyEntries, groupByCategory, period]);

  const defaultEntryDate = (() => {
    const todayKey = formatLocalDate(new Date());
    if (todayKey >= period.from && todayKey <= period.to) return todayKey;
    return period.to < todayKey ? period.to : period.from;
  })();

  const handleEntrySaved = (entry: FinanceEntry) => {
    setEntryModalOpen(false);
    setCurrency(entry.currency);
    if (entry.date < period.from || entry.date > period.to) return;
    setEntries((current) => [entry, ...current].sort((a, b) => (
      b.date.localeCompare(a.date) || b.id - a.id
    )));
  };

  const handleDeleteEntry = async (entry: FinanceEntry) => {
    setDeletingEntryId(entry.id);
    try {
      await deleteFinanceEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeDeleteEntryFailed'));
    } finally {
      setDeletingEntryId(null);
    }
  };

  const handleCategoryDeleted = (categoryId: number) => {
    setCategories((current) => current.filter((category) => category.id !== categoryId));
    setEntries((current) => current.map((entry) => (
      entry.category_id === categoryId ? { ...entry, category_id: null } : entry
    )));
  };

  const totalLabel = isExpense ? t('financeExpenses') : t('financeIncome');

  return (
    <Layout>
      <div className="finance-page">
        <div className="finance-page-intro">
          <PageTitle title={t('financeTitle')} />

          <div className="finance-toolbar">
            <div className="finance-tabs" role="tablist" aria-label={t('financeTitle')}>
              {(['expense', 'income'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={tab === kind}
                  className={`finance-tab${tab === kind ? ' is-active' : ''}`}
                  onClick={() => setTab(kind)}
                >
                  {kind === 'expense' ? t('financeExpenses') : t('financeIncome')}
                </button>
              ))}
            </div>

            <button type="button" className="finance-period-btn" onClick={() => setPeriodOpen(true)}>
              <CalendarRange size={18} strokeWidth={2.25} />
              <span>{formatPeriod(period)}</span>
            </button>

            {currencyOptions.length > 1 && (
              <div className="finance-currency-switch" role="radiogroup" aria-label={t('financeCurrency')}>
                {currencyOptions.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={currency === code}
                    className={currency === code ? 'is-active' : ''}
                    onClick={() => setCurrency(code)}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="finance-controls">
            <button type="button" className="tasks-create-btn" onClick={() => setEntryModalOpen(true)}>
              <Plus size={18} strokeWidth={2.5} />
              <span>{isExpense ? t('financeAddExpense') : t('financeAddIncome')}</span>
            </button>
            <button type="button" className="tasks-tag-create-btn" onClick={() => setCategoriesOpen(true)}>
              <Layers size={18} strokeWidth={2.25} />
              <span>{isExpense ? t('financeCategories') : t('financeSources')}</span>
            </button>
          </div>
        </div>

        {error && <p className="tasks-error">{error}</p>}

        {!loaded ? (
          <p className="tasks-placeholder">{t('financeLoading')}</p>
        ) : (
          <>
            <div className="finance-summary">
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
              <div className="finance-panel finance-summary-card">
                <span className="finance-summary-label">{t('financeBalance')}</span>
                <span className={`finance-summary-value${totals.balance < 0 ? ' finance-amount-expense' : ''}`}>
                  {totals.balance < 0 ? '−' : ''}{formatMoney(Math.abs(totals.balance), currency)}
                </span>
              </div>
            </div>

            <div className="finance-charts">
              <section className="finance-panel">
                <h2 className="finance-panel-title">
                  {isExpense ? t('financeExpensesByCategory') : t('financeIncomeBySource')}
                </h2>
                {donutItems.length === 0 ? (
                  <p className="finance-empty">{isExpense ? t('financeNoExpenses') : t('financeNoIncome')}</p>
                ) : (
                  <FinanceDonutChart items={donutItems} currency={currency} totalLabel={totalLabel} />
                )}
              </section>

              <section className="finance-panel">
                <h2 className="finance-panel-title">
                  {isExpense ? t('financeExpensesDynamics') : t('financeIncomeDynamics')}
                </h2>
                <FinanceMonthChart columns={chartColumns} currency={currency} />
              </section>
            </div>

            <section className="finance-panel">
              <h2 className="finance-panel-title">{t('financeEntriesTitle')}</h2>
              {tabEntries.length === 0 ? (
                <p className="finance-empty">{t('financeNoEntries')}</p>
              ) : (
                <ul className="finance-entries">
                  {tabEntries.map((entry) => {
                    const category = categoryOf(entry);
                    const amount = formatMoney(entry.amount_cents, entry.currency);
                    return (
                      <li key={entry.id} className="finance-entry">
                        <FinanceIconBadge icon={category.icon} color={category.color} />
                        <div className="finance-entry-body">
                          <span className="finance-entry-title">{category.label}</span>
                          <span className="finance-entry-meta">
                            {parseLocalDate(entry.date).toLocaleDateString(dateLocaleTag, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {entry.note && ` · ${entry.note}`}
                          </span>
                        </div>
                        <span
                          className={`finance-entry-amount ${
                            entry.kind === 'income' ? 'finance-amount-income' : 'finance-amount-expense'
                          }`}
                        >
                          {entry.kind === 'income' ? '+' : '−'}{amount}
                        </span>
                        <button
                          type="button"
                          className="finance-entry-delete"
                          aria-label={t('financeDeleteEntryAria', { amount })}
                          disabled={deletingEntryId === entry.id}
                          onClick={() => void handleDeleteEntry(entry)}
                        >
                          <Trash2 size={16} />
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

      {entryModalOpen && (
        <FinanceEntryModal
          kind={tab}
          categories={tabCategories}
          defaultDate={defaultEntryDate}
          onClose={() => setEntryModalOpen(false)}
          onSaved={handleEntrySaved}
          onManageCategories={() => {
            setEntryModalOpen(false);
            setCategoriesOpen(true);
          }}
        />
      )}

      {categoriesOpen && (
        <FinanceCategoryModal
          kind={tab}
          categories={tabCategories}
          onClose={() => setCategoriesOpen(false)}
          onCreated={(category) => setCategories((current) => (
            [...current, category].sort((a, b) => a.name.localeCompare(b.name, dateLocaleTag))
          ))}
          onDeleted={handleCategoryDeleted}
        />
      )}

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
