import { useState, type FormEvent } from 'react';
import { Checkbox } from './Checkbox';
import { FinanceIconBadge } from './FinanceIconBadge';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { t } from '../i18n';

export interface BalanceAccountOption {
  key: string;
  name: string;
  icon: string;
  color: string;
}

interface FinanceBalanceAccountsModalProps {
  options: BalanceAccountOption[];
  hidden: string[];
  onClose: () => void;
  onSave: (hidden: string[]) => Promise<void>;
}

export function FinanceBalanceAccountsModal({ options, hidden, onClose, onSave }: FinanceBalanceAccountsModalProps) {
  const [draft, setDraft] = useState(() => new Set(hidden));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (key: string, visible: boolean) => {
    setDraft((current) => {
      const next = new Set(current);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave([...draft]);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeBalanceSaveFailed'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('financeBalanceAccountsTitle')}
      isOpen
      onClose={onClose}
      className="task-editor-modal glass-modal"
    >
      <form className="finance-balance-picker" onSubmit={handleSubmit}>
        <p className="finance-balance-picker-hint">{t('financeBalanceAccountsHint')}</p>
        {options.length === 0 ? (
          <p className="finance-empty">{t('financeNoAccounts')}</p>
        ) : (
          <div className="finance-balance-picker-list">
            {options.map((option) => (
              <Checkbox
                key={option.key}
                className="finance-balance-picker-row"
                checked={!draft.has(option.key)}
                onChange={(checked) => toggle(option.key, checked)}
                ariaLabel={option.name}
              >
                <FinanceIconBadge icon={option.icon} color={option.color} size="sm" />
                <span className="finance-balance-name">{option.name}</span>
              </Checkbox>
            ))}
          </div>
        )}
        {error && <p className="tasks-error">{error}</p>}
        <ModalActions onCancel={onClose} submitLabel={t('save')} pending={saving} submitFirst />
      </form>
    </Modal>
  );
}
