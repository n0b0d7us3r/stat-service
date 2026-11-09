import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { FinanceIconBadge } from './FinanceIconBadge';
import { dateLocaleTag, t } from '../i18n';
import type { FinanceAccount, FinanceEntry, TodayRates } from '../types';
import { parseLocalDate } from '../utils/date';
import { formatMoney, formatRateQuote, toBaseCents, todayRatesSourceLabel } from '../utils/finance';

interface FinanceEntryDetailsModalProps {
  entry: FinanceEntry;
  category: { label: string; color: string; icon: string };
  account: FinanceAccount | undefined;
  baseCurrency: string;
  todayRates: TodayRates | null;
  deleting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function FinanceEntryDetailsModal({
  entry,
  category,
  account,
  baseCurrency,
  todayRates,
  deleting,
  onClose,
  onEdit,
  onDelete,
}: FinanceEntryDetailsModalProps) {
  const [confirming, setConfirming] = useState(false);
  const isIncome = entry.kind === 'income';
  const baseCents = toBaseCents(entry, baseCurrency, todayRates);
  const showConverted = entry.currency !== baseCurrency && baseCents !== null;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('financeType'), value: isIncome ? t('financeIncomeOne') : t('financeExpenseOne') },
    {
      label: isIncome ? t('financeSource') : t('financeCategory'),
      value: (
        <span className="finance-details-chip">
          <FinanceIconBadge icon={category.icon} color={category.color} size="sm" />
          {category.label}
        </span>
      ),
    },
    {
      label: isIncome ? t('financeAccountTo') : t('financeAccountFrom'),
      value: account ? (
        <span className="finance-details-chip">
          <FinanceIconBadge icon={account.icon} color={account.color} size="sm" />
          {account.name}
        </span>
      ) : t('financeNoAccount'),
    },
    {
      label: t('financeDate'),
      value: parseLocalDate(entry.date).toLocaleDateString(dateLocaleTag, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
  ];

  if (entry.rate_mode === 'floating' && entry.currency !== baseCurrency) {
    const todayRate = todayRates?.base === baseCurrency ? todayRates.rates[entry.currency] : undefined;
    rows.push({
      label: t('financeRate'),
      value: (
        <span className="finance-details-rate">
          <span>{t('financeRateFloating')}</span>
          <span className="finance-rate-source">
            {todayRate && todayRates
              ? `${formatRateQuote(entry.currency, baseCurrency, todayRate)} · ${todayRatesSourceLabel(todayRates, entry.currency)}`
              : t('financeRateTodayMissing')}
          </span>
        </span>
      ),
    });
  } else if (entry.rate != null && entry.rate_currency) {
    rows.push({
      label: t('financeRate'),
      value: formatRateQuote(entry.currency, entry.rate_currency, entry.rate),
    });
  }

  if (entry.note) {
    rows.push({ label: t('financeNote'), value: entry.note });
  }

  if (confirming) {
    return (
      <Modal
        title={t('financeDeleteEntryTitle')}
        isOpen
        onClose={() => setConfirming(false)}
        className="glass-modal"
      >
        <p className="finance-modal-hint">
          {t('financeDeleteEntryConfirm', {
            amount: `${isIncome ? '+' : '−'}${formatMoney(entry.amount_cents, entry.currency)}`,
            category: category.label,
          })}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-action-cancel finance-details-delete is-confirming"
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? t('deleting') : t('delete')}
          </button>
          <button
            type="button"
            className="modal-action-cancel"
            disabled={deleting}
            onClick={() => setConfirming(false)}
          >
            {t('cancel')}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('financeEntryDetails')}
      isOpen
      onClose={onClose}
      className="task-editor-modal glass-modal"
      headerExtra={(
        <button
          type="button"
          className="task-icon-btn task-editor-edit"
          aria-pressed={false}
          aria-label={t('financeEditEntry')}
          onClick={onEdit}
        >
          <Pencil size={20} />
        </button>
      )}
    >
      <div className="finance-details">
        <div className="finance-details-hero">
          <FinanceIconBadge icon={category.icon} color={category.color} size="lg" />
          <span className={`finance-details-amount ${isIncome ? 'finance-amount-income' : 'finance-amount-expense'}`}>
            {isIncome ? '+' : '−'}{formatMoney(entry.amount_cents, entry.currency)}
          </span>
          {showConverted && baseCents !== null && (
            <span className="finance-details-converted">≈ {formatMoney(baseCents, baseCurrency)}</span>
          )}
        </div>

        <dl className="finance-details-list">
          {rows.map((row) => (
            <div key={row.label} className="finance-details-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-action-cancel finance-details-delete"
            onClick={() => setConfirming(true)}
          >
            {t('delete')}
          </button>
          <button type="button" className="modal-action-cancel" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
