import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { FinanceIconBadge } from './FinanceIconBadge';
import type { FinanceCollectionMode } from './FinanceCategoryModal';
import { ApiError } from '../api/client';
import { createFinanceEntry, updateFinanceEntry } from '../api/finance';
import type { FinanceAccount, FinanceCategory, FinanceEntry, FinanceEntryKind } from '../types';
import {
  FINANCE_CURRENCIES,
  displayRateToStored,
  formatMoney,
  rateQuote,
  storedRateToDisplay,
} from '../utils/finance';
import { t } from '../i18n';

interface FinanceEntryModalProps {
  kind: FinanceEntryKind;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  baseCurrency: string;
  defaultDate: string;
  entry?: FinanceEntry;
  onClose: () => void;
  onSaved: (entry: FinanceEntry) => void;
  onManage: (mode: FinanceCollectionMode) => void;
}

function initialId(items: Array<{ id: number }>, current: number | null | undefined): number | null {
  if (current != null && items.some((item) => item.id === current)) return current;
  return items.length === 1 ? items[0].id : null;
}

function ChoiceGroup<T extends FinanceCategory | FinanceAccount>({
  name,
  label,
  items,
  value,
  onChange,
}: {
  name: string;
  label: string;
  items: T[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="task-editor-field">
      <span>{label}</span>
      <div className="finance-category-picker" role="radiogroup" aria-label={label}>
        {items.map((item) => (
          <label key={item.id} className="finance-category-choice">
            <input type="radio" name={name} checked={value === item.id} onChange={() => onChange(item.id)} />
            <span>
              <FinanceIconBadge icon={item.icon} color={item.color} size="sm" />
              {item.name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function FinanceEntryModal({
  kind,
  categories,
  accounts,
  baseCurrency,
  defaultDate,
  entry,
  onClose,
  onSaved,
  onManage,
}: FinanceEntryModalProps) {
  const isExpense = kind === 'expense';
  const [amount, setAmount] = useState(() => (entry ? String(entry.amount_cents / 100) : ''));
  const [currency, setCurrency] = useState(entry?.currency ?? baseCurrency);
  const [rate, setRate] = useState(() => {
    if (entry?.rate == null || entry.rate_currency !== baseCurrency) return '';
    const { inverted } = rateQuote(entry.currency, baseCurrency);
    return String(Number(storedRateToDisplay(entry.rate, inverted).toFixed(6)));
  });
  const [date, setDate] = useState(entry?.date ?? defaultDate);
  const [categoryId, setCategoryId] = useState(() => initialId(categories, entry?.category_id));
  const [accountId, setAccountId] = useState(() => initialId(accounts, entry?.account_id));
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const needsRate = currency !== baseCurrency;
  const quote = rateQuote(currency, baseCurrency);
  const rateNumber = Number(rate.replace(',', '.'));
  const amountNumber = Number(amount.replace(',', '.'));
  const convertedPreview = needsRate && rateNumber > 0 && amountNumber > 0
    ? formatMoney(
      Math.round(amountNumber * 100 * displayRateToStored(rateNumber, quote.inverted)),
      baseCurrency,
    )
    : null;

  const missing: FinanceCollectionMode | null = categories.length === 0 ? kind : accounts.length === 0 ? 'account' : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('financeAmountInvalid'));
      return;
    }
    if (categoryId == null) {
      setError(isExpense ? t('financeChooseCategory') : t('financeChooseSource'));
      return;
    }
    if (accountId == null) {
      setError(t('financeChooseAccount'));
      return;
    }
    const displayRate = needsRate ? Number(rate.replace(',', '.')) : null;
    if (displayRate !== null && (!Number.isFinite(displayRate) || displayRate <= 0)) {
      setError(t('financeRateInvalid'));
      return;
    }
    const rateValue = displayRate === null ? null : displayRateToStored(displayRate, quote.inverted);

    setError('');
    setSaving(true);

    const input = { amount: value, currency, categoryId, accountId, rate: rateValue, date, note };

    try {
      onSaved(entry ? await updateFinanceEntry(entry.id, input) : await createFinanceEntry({ ...input, kind }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeSaveEntryFailed'));
      setSaving(false);
    }
  };

  const missingCopy = {
    expense: { hint: t('financeNeedCategory'), action: t('financeCategories') },
    income: { hint: t('financeNeedSource'), action: t('financeSources') },
    account: { hint: t('financeNeedAccount'), action: t('financeAccounts') },
  };

  const title = entry
    ? (isExpense ? t('financeEditExpenseTitle') : t('financeEditIncomeTitle'))
    : (isExpense ? t('financeAddExpenseTitle') : t('financeAddIncomeTitle'));

  return (
    <Modal
      title={title}
      isOpen
      onClose={onClose}
      className={entry ? 'task-editor-modal glass-modal' : 'glass-modal'}
      headerExtra={entry ? (
        <button
          type="button"
          className="task-icon-btn task-editor-edit"
          aria-pressed
          aria-label={t('stopEditing')}
          onClick={onClose}
        >
          <Pencil size={20} />
        </button>
      ) : undefined}
    >
      {missing ? (
        <form
          className="task-editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            onManage(missing);
          }}
        >
          <p className="finance-modal-hint">{missingCopy[missing].hint}</p>
          <ModalActions onCancel={onClose} submitLabel={missingCopy[missing].action} />
        </form>
      ) : (
        <form className="task-editor-form" onSubmit={handleSubmit}>
          {error && <p className="task-editor-error">{error}</p>}

          <div className="finance-amount-row">
            <label className="task-editor-field">
              <span>{t('financeAmount')}</span>
              <input
                type="text"
                inputMode="decimal"
                className="task-editor-input"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
                required
              />
            </label>
            <label className="task-editor-field">
              <span>{t('financeCurrency')}</span>
              <select
                className="task-editor-select"
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setRate('');
                }}
              >
                {FINANCE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
          </div>

          {needsRate && (
            <div className="task-editor-field">
              <span>{t('financeRate')}</span>
              <div className="finance-rate-input">
                <span>1 {quote.unit} =</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="task-editor-input"
                  value={rate}
                  onChange={(event) => setRate(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0"
                  aria-label={t('financeRate')}
                  required
                />
                <span>{quote.quote}</span>
              </div>
              {convertedPreview && (
                <p className="finance-rate-preview">≈ {convertedPreview}</p>
              )}
            </div>
          )}

          <ChoiceGroup
            name="financeEntryCategory"
            label={isExpense ? t('financeCategory') : t('financeSource')}
            items={categories}
            value={categoryId}
            onChange={setCategoryId}
          />

          <label className="task-editor-field">
            <span>{isExpense ? t('financeAccountFrom') : t('financeAccountTo')}</span>
            <select
              className="task-editor-select"
              value={accountId ?? ''}
              onChange={(event) => setAccountId(event.target.value ? Number(event.target.value) : null)}
              required
            >
              {accountId == null && <option value="">{t('financeChooseAccount')}</option>}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>

          <label className="task-editor-field">
            <span>{t('financeDate')}</span>
            <input
              type="date"
              className="task-editor-input task-editor-date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <label className="task-editor-field">
            <span>{t('financeNote')}</span>
            <input
              type="text"
              className="task-editor-input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('financeNotePlaceholder')}
              maxLength={200}
            />
          </label>

          <ModalActions onCancel={onClose} submitLabel={t('save')} pending={saving} />
        </form>
      )}
    </Modal>
  );
}
