import { useState } from 'react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { FinanceIconBadge } from './FinanceIconBadge';
import { ApiError } from '../api/client';
import { createFinanceEntry } from '../api/finance';
import type { FinanceCategory, FinanceEntry, FinanceEntryKind } from '../types';
import { DEFAULT_CURRENCY, FINANCE_CURRENCIES } from '../utils/finance';
import { t } from '../i18n';

interface FinanceEntryModalProps {
  kind: FinanceEntryKind;
  categories: FinanceCategory[];
  defaultDate: string;
  onClose: () => void;
  onSaved: (entry: FinanceEntry) => void;
  onManageCategories: () => void;
}

export function FinanceEntryModal({
  kind,
  categories,
  defaultDate,
  onClose,
  onSaved,
  onManageCategories,
}: FinanceEntryModalProps) {
  const isExpense = kind === 'expense';
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState<number | null>(categories.length === 1 ? categories[0].id : null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const chooseLabel = isExpense ? t('financeChooseCategory') : t('financeChooseSource');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('financeAmountInvalid'));
      return;
    }
    if (categoryId == null) {
      setError(chooseLabel);
      return;
    }

    setError('');
    setSaving(true);

    try {
      onSaved(await createFinanceEntry({ kind, amount: value, currency, categoryId, date, note }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeSaveEntryFailed'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isExpense ? t('financeAddExpenseTitle') : t('financeAddIncomeTitle')}
      isOpen
      onClose={onClose}
      className="glass-modal"
    >
      {categories.length === 0 ? (
        <form
          className="task-editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            onManageCategories();
          }}
        >
          <p className="finance-modal-hint">
            {isExpense ? t('financeNeedCategory') : t('financeNeedSource')}
          </p>
          <ModalActions
            onCancel={onClose}
            submitLabel={isExpense ? t('financeCategories') : t('financeSources')}
          />
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
                onChange={(event) => setCurrency(event.target.value)}
              >
                {FINANCE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="task-editor-field">
            <span>{isExpense ? t('financeCategory') : t('financeSource')}</span>
            <div className="finance-category-picker" role="radiogroup" aria-label={chooseLabel}>
              {categories.map((category) => (
                <label key={category.id} className="finance-category-choice">
                  <input
                    type="radio"
                    name="financeEntryCategory"
                    checked={categoryId === category.id}
                    onChange={() => setCategoryId(category.id)}
                  />
                  <span>
                    <FinanceIconBadge icon={category.icon} color={category.color} size="sm" />
                    {category.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="task-editor-field">
            <span>{t('financeDate')}</span>
            <input
              type="date"
              className="task-editor-input"
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
