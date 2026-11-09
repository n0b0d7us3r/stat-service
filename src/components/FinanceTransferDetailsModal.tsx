import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { FinanceIconBadge } from './FinanceIconBadge';
import { dateLocaleTag, t } from '../i18n';
import type { FinanceAccount, FinanceTransfer } from '../types';
import { parseLocalDate } from '../utils/date';
import { formatMoney, formatRateQuote } from '../utils/finance';
import { TRANSFER_ICON } from '../utils/financeIcons';

export const TRANSFER_COLOR = '#0a84ff';

interface FinanceTransferDetailsModalProps {
  transfer: FinanceTransfer;
  fromAccount: FinanceAccount | undefined;
  toAccount: FinanceAccount | undefined;
  deleting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function transferAmountLabel(transfer: FinanceTransfer): string {
  const sent = formatMoney(transfer.amount_cents, transfer.currency);
  if (transfer.currency === transfer.to_currency) return sent;
  return `${sent} → ${formatMoney(transfer.to_amount_cents, transfer.to_currency)}`;
}

function AccountChip({ account }: { account: FinanceAccount | undefined }) {
  if (!account) return <>{t('financeNoAccount')}</>;
  return (
    <span className="finance-details-chip">
      <FinanceIconBadge icon={account.icon} color={account.color} size="sm" />
      {account.name}
    </span>
  );
}

export function FinanceTransferDetailsModal({
  transfer,
  fromAccount,
  toAccount,
  deleting,
  onClose,
  onEdit,
  onDelete,
}: FinanceTransferDetailsModalProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Modal
        title={t('financeDeleteTransferTitle')}
        isOpen
        onClose={() => setConfirming(false)}
        className="glass-modal"
      >
        <p className="finance-modal-hint">
          {t('financeDeleteTransferConfirm', { amount: transferAmountLabel(transfer) })}
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

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('financeType'), value: t('financeTransferOne') },
    { label: t('financeTransferFrom'), value: <AccountChip account={fromAccount} /> },
    { label: t('financeTransferTo'), value: <AccountChip account={toAccount} /> },
  ];

  if (transfer.currency !== transfer.to_currency) {
    rows.push({ label: t('financeTransferReceived'), value: formatMoney(transfer.to_amount_cents, transfer.to_currency) });
    if (transfer.rate) {
      rows.push({ label: t('financeRate'), value: formatRateQuote(transfer.currency, transfer.to_currency, transfer.rate) });
    }
  }

  rows.push({
    label: t('financeDate'),
    value: parseLocalDate(transfer.date).toLocaleDateString(dateLocaleTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  });

  if (transfer.note) {
    rows.push({ label: t('financeNote'), value: transfer.note });
  }

  return (
    <Modal
      title={t('financeTransferOne')}
      isOpen
      onClose={onClose}
      className="task-editor-modal glass-modal"
      headerExtra={(
        <button
          type="button"
          className="task-icon-btn task-editor-edit"
          aria-pressed={false}
          aria-label={t('financeEditTransfer')}
          onClick={onEdit}
        >
          <Pencil size={20} />
        </button>
      )}
    >
      <div className="finance-details">
        <div className="finance-details-hero">
          <FinanceIconBadge icon={TRANSFER_ICON} color={TRANSFER_COLOR} size="lg" />
          <span className="finance-details-amount">{formatMoney(transfer.amount_cents, transfer.currency)}</span>
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
