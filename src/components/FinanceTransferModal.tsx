import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createFinanceTransfer, updateFinanceTransfer } from '../api/finance';
import { t } from '../i18n';
import type { FinanceAccount, FinanceTransfer, TodayRates } from '../types';
import {
  FINANCE_CURRENCIES,
  crossRate,
  displayRateToStored,
  formatMoney,
  rateQuote,
  storedRateToDisplay,
} from '../utils/finance';

interface FinanceTransferModalProps {
  accounts: FinanceAccount[];
  baseCurrency: string;
  todayRates: TodayRates | null;
  defaultDate: string;
  transfer?: FinanceTransfer;
  onClose: () => void;
  onSaved: (transfer: FinanceTransfer) => void;
  onManageAccounts: () => void;
}

function displayRate(rate: number, inverted: boolean): string {
  return String(Number(storedRateToDisplay(rate, inverted).toFixed(6)));
}

function accountIdOrNull(accounts: FinanceAccount[], id: number | null | undefined): number | null {
  return id != null && accounts.some((account) => account.id === id) ? id : null;
}

export function FinanceTransferModal({
  accounts,
  baseCurrency,
  todayRates,
  defaultDate,
  transfer,
  onClose,
  onSaved,
  onManageAccounts,
}: FinanceTransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState(() => accountIdOrNull(accounts, transfer?.from_account_id));
  const [toAccountId, setToAccountId] = useState(() => accountIdOrNull(accounts, transfer?.to_account_id));
  const [amount, setAmount] = useState(() => (transfer ? String(transfer.amount_cents / 100) : ''));
  const [currency, setCurrency] = useState(transfer?.currency ?? baseCurrency);
  const [toCurrency, setToCurrency] = useState(transfer?.to_currency ?? baseCurrency);
  const [rate, setRate] = useState(() => {
    if (!transfer?.rate) return '';
    return displayRate(transfer.rate, rateQuote(transfer.currency, transfer.to_currency).inverted);
  });
  const [date, setDate] = useState(transfer?.date ?? defaultDate);
  const [note, setNote] = useState(transfer?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const exchange = currency !== toCurrency;
  const quote = rateQuote(currency, toCurrency);
  const todayRate = exchange ? crossRate(todayRates, currency, toCurrency) : undefined;
  const rateNumber = Number(rate.replace(',', '.'));
  const amountNumber = Number(amount.replace(',', '.'));
  const receivedPreview = exchange && rateNumber > 0 && amountNumber > 0
    ? formatMoney(Math.round(amountNumber * 100 * displayRateToStored(rateNumber, quote.inverted)), toCurrency)
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
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError(t('financeAmountInvalid'));
      return;
    }
    if (exchange && (!Number.isFinite(rateNumber) || rateNumber <= 0)) {
      setError(t('financeRateInvalid'));
      return;
    }

    setError('');
    setSaving(true);
    const input = {
      fromAccountId,
      toAccountId,
      amount: amountNumber,
      currency,
      toCurrency,
      rate: exchange ? displayRateToStored(rateNumber, quote.inverted) : null,
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

  const currencySelect = (label: string, value: string, onChange: (code: string) => void) => (
    <label className="task-editor-field">
      <span>{label}</span>
      <select
        className="task-editor-select"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setRate('');
        }}
      >
        {FINANCE_CURRENCIES.map((code) => (
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
            {currencySelect(t('financeCurrency'), currency, setCurrency)}
          </div>

          {currencySelect(t('financeTransferToCurrency'), toCurrency, setToCurrency)}

          {exchange && (
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
                  placeholder={todayRate ? String(Number(storedRateToDisplay(todayRate, quote.inverted).toFixed(4))) : '0'}
                  aria-label={t('financeRate')}
                  required
                />
                <span>{quote.quote}</span>
              </div>
              {receivedPreview && (
                <p className="finance-rate-preview">{t('financeTransferReceived')}: {receivedPreview}</p>
              )}
            </div>
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
