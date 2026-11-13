import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createFinanceTransfer, updateFinanceTransfer } from '../api/finance';
import { t } from '../i18n';
import type { FinanceAccount, FinanceTransfer } from '../types';
import { formatTransferRateQuote } from '../utils/finance';

interface FinanceTransferModalProps {
  accounts: FinanceAccount[];
  baseCurrency: string;
  currencies: string[];
  defaultDate: string;
  transfer?: FinanceTransfer;
  onClose: () => void;
  onSaved: (transfer: FinanceTransfer) => void;
  onManageAccounts: () => void;
}

function centsOf(value: string, empty: number | null): number | null {
  if (value.trim() === '') return empty;
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function formatCentsInput(cents: number, sample: string): string {
  const text = (cents / 100).toFixed(2).replace(/\.?0+$/, '');
  return sample.includes(',') ? text.replace('.', ',') : text;
}

/** При одной валюте зачисление по умолчанию — списание минус комиссия. */
function sameCurrencyCredit(amount: string, fee: string): string {
  const amountCents = centsOf(amount, null);
  if (amountCents == null || amountCents <= 0) return '';
  const feeCents = centsOf(fee, 0);
  if (feeCents == null || feeCents < 0 || feeCents >= amountCents) return formatCentsInput(amountCents, amount);
  return formatCentsInput(amountCents - feeCents, amount);
}

function moneyNumber(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function FinanceTransferModal({
  accounts,
  baseCurrency,
  currencies,
  defaultDate,
  transfer,
  onClose,
  onSaved,
  onManageAccounts,
}: FinanceTransferModalProps) {
  const currencyOptions = [...new Set([
    ...currencies,
    ...(transfer?.currency ? [transfer.currency] : []),
    ...(transfer?.to_currency ? [transfer.to_currency] : []),
  ])];
  const [fromAccountId, setFromAccountId] = useState(() => accountIdOrNull(accounts, transfer?.from_account_id));
  const [toAccountId, setToAccountId] = useState(() => accountIdOrNull(accounts, transfer?.to_account_id));
  const [amount, setAmount] = useState(() => (transfer ? String(transfer.amount_cents / 100) : ''));
  const [toAmount, setToAmount] = useState(() => (transfer ? String(transfer.to_amount_cents / 100) : ''));
  const [toAmountTouched, setToAmountTouched] = useState(() => transfer != null);
  const [currency, setCurrency] = useState(transfer?.currency ?? baseCurrency);
  const [toCurrency, setToCurrency] = useState(transfer?.to_currency ?? baseCurrency);
  const [fee, setFee] = useState(() => (transfer?.fee_cents ? String(transfer.fee_cents / 100) : ''));
  const [date, setDate] = useState(transfer?.date ?? defaultDate);
  const [note, setNote] = useState(transfer?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const exchange = currency !== toCurrency;
  const credited = exchange || toAmountTouched ? toAmount : sameCurrencyCredit(amount, fee);
  const amountCents = centsOf(amount, null);
  const creditedCents = centsOf(credited, null);
  const feeCents = centsOf(fee, 0);
  const ratePreview = exchange
    && amountCents != null && amountCents > 0
    && creditedCents != null && creditedCents > 0
    && feeCents != null && feeCents >= 0 && feeCents < amountCents
    ? formatTransferRateQuote(currency, toCurrency, creditedCents / (amountCents - feeCents))
    : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (fromAccountId == null || toAccountId == null) {
      setError(t('financeChooseAccount'));
      return;
    }
    if (fromAccountId === toAccountId) {
      setError(t('financeTransferSameAccount'));
      return;
    }
    if (amountCents == null || amountCents <= 0) {
      setError(t('financeAmountInvalid'));
      return;
    }
    if (creditedCents == null || creditedCents <= 0) {
      setError(t('financeTransferToAmountInvalid'));
      return;
    }
    if (feeCents == null || feeCents < 0 || feeCents >= amountCents) {
      setError(t('financeTransferFeeInvalid'));
      return;
    }

    setError('');
    setSaving(true);
    const input = {
      fromAccountId,
      toAccountId,
      amount: moneyNumber(amountCents),
      toAmount: moneyNumber(creditedCents),
      currency,
      toCurrency,
      fee: moneyNumber(feeCents),
      date,
      note,
    };

    try {
      onSaved(transfer ? await updateFinanceTransfer(transfer.id, input) : await createFinanceTransfer(input));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeSaveTransferFailed'));
      setSaving(false);
    }
  };

  const accountSelect = (
    label: string,
    value: number | null,
    onChange: (id: number | null) => void,
  ) => (
    <label className="task-editor-field">
      <span>{label}</span>
      <select
        className="task-editor-select"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        required
      >
        {value == null && <option value="">{t('financeChooseAccount')}</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>{account.name}</option>
        ))}
      </select>
    </label>
  );

  const currencySelect = (ariaLabel: string, value: string, onChange: (code: string) => void) => (
    <label className="task-editor-field finance-currency-field">
      <select
        className="task-editor-select"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {currencyOptions.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal
      title={transfer ? t('financeEditTransferTitle') : t('financeTransferTitle')}
      isOpen
      onClose={onClose}
      className={transfer ? 'task-editor-modal glass-modal' : 'glass-modal'}
      headerExtra={transfer ? (
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
      {accounts.length < 2 ? (
        <form
          className="task-editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            onManageAccounts();
          }}
        >
          <p className="finance-modal-hint">{t('financeTransferNeedAccounts')}</p>
          <ModalActions onCancel={onClose} submitLabel={t('financeAccounts')} />
        </form>
      ) : (
        <form className="task-editor-form" onSubmit={handleSubmit}>
          {error && <p className="task-editor-error">{error}</p>}

          {accountSelect(t('financeTransferFrom'), fromAccountId, setFromAccountId)}
          {accountSelect(t('financeTransferTo'), toAccountId, setToAccountId)}

          <div className="finance-amount-row">
            <label className="task-editor-field">
              <span>{t('financeTransferDebited')}</span>
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
            {currencySelect(t('financeCurrency'), currency, setCurrency)}
          </div>

          <div className="finance-amount-row">
            <label className="task-editor-field">
              <span>{t('financeTransferReceived')}</span>
              <input
                type="text"
                inputMode="decimal"
                className="task-editor-input"
                value={credited}
                onChange={(event) => {
                  setToAmountTouched(true);
                  setToAmount(event.target.value.replace(/[^\d.,]/g, ''));
                }}
                placeholder="0"
                required
              />
            </label>
            {currencySelect(t('financeTransferToCurrency'), toCurrency, setToCurrency)}
          </div>

          <label className="task-editor-field">
            <span>{t('financeTransferFee')}</span>
            <div className="finance-rate-input">
              <input
                type="text"
                inputMode="decimal"
                className="task-editor-input"
                value={fee}
                onChange={(event) => setFee(event.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
                aria-label={t('financeTransferFee')}
              />
              <span>{currency}</span>
            </div>
            <p className="finance-rate-preview">{t('financeTransferFeeHint')}</p>
          </label>

          {ratePreview && (
            <p className="finance-rate-preview">{t('financeRate')}: {ratePreview}</p>
          )}

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

function accountIdOrNull(accounts: FinanceAccount[], id: number | null | undefined): number | null {
  return id != null && accounts.some((account) => account.id === id) ? id : null;
}
