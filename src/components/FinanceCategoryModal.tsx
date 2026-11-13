import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { FinanceIconBadge } from './FinanceIconBadge';
import { ApiError } from '../api/client';
import {
  createFinanceAccount,
  createFinanceCategory,
  deleteFinanceAccount,
  deleteFinanceCategory,
} from '../api/finance';
import type { FinanceAccount, FinanceCategory } from '../types';
import { FINANCE_COLORS } from '../utils/finance';
import { ACCOUNT_ICONS, FINANCE_ICONS } from '../utils/financeIcons';
import { t, type MessageKey } from '../i18n';

export type FinanceCollectionMode = 'expense' | 'income' | 'account';

type FinanceCollectionItem = FinanceCategory | FinanceAccount;

interface FinanceCategoryModalProps {
  mode: FinanceCollectionMode;
  items: FinanceCollectionItem[];
  onClose: () => void;
  onCreated: (item: FinanceCollectionItem) => void;
  onDeleted: (itemId: number) => void;
}

const COPY: Record<FinanceCollectionMode, {
  title: MessageKey;
  list: MessageKey;
  placeholder: MessageKey;
  deleteHint: MessageKey;
  color: number;
  icon: string;
}> = {
  expense: {
    title: 'financeCategoryManageTitle',
    list: 'financeCategories',
    placeholder: 'financeCategoryNamePlaceholder',
    deleteHint: 'financeCategoryDeleteHint',
    color: 5,
    icon: 'cart',
  },
  income: {
    title: 'financeSourceManageTitle',
    list: 'financeSources',
    placeholder: 'financeSourceNamePlaceholder',
    deleteHint: 'financeSourceDeleteHint',
    color: 3,
    icon: 'wallet',
  },
  account: {
    title: 'financeAccountManageTitle',
    list: 'financeAccounts',
    placeholder: 'financeAccountNamePlaceholder',
    deleteHint: 'financeAccountDeleteHint',
    color: 6,
    icon: 'card',
  },
};

export function FinanceCategoryModal({ mode, items, onClose, onCreated, onDeleted }: FinanceCategoryModalProps) {
  const copy = COPY[mode];
  const icons = mode === 'account'
    ? FINANCE_ICONS.filter(({ key }) => (ACCOUNT_ICONS as readonly string[]).includes(key))
    : FINANCE_ICONS;
  const [name, setName] = useState('');
  const [color, setColor] = useState(FINANCE_COLORS[copy.color]);
  const [icon, setIcon] = useState(copy.icon);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('financeCategoryNameRequired'));
      return;
    }

    setError('');
    setSaving(true);

    try {
      const created = mode === 'account'
        ? await createFinanceAccount({ name: trimmed, color, icon })
        : await createFinanceCategory({ kind: mode, name: trimmed, color, icon });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeCreateCategoryFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    setError('');
    setDeletingId(itemId);

    try {
      if (mode === 'account') {
        await deleteFinanceAccount(itemId);
      } else {
        await deleteFinanceCategory(itemId);
      }
      onDeleted(itemId);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeDeleteCategoryFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal title={t(copy.title)} isOpen onClose={onClose} className="glass-modal finance-category-modal">
      <div className="tag-manage-modal">
        {error && <p className="task-editor-error">{error}</p>}

        <form id="finance-category-create-form" className="task-editor-form tag-manage-create" onSubmit={handleCreate}>
          <div className="finance-category-preview">
            <FinanceIconBadge icon={icon} color={color} size="lg" />
            <input
              type="text"
              className="task-editor-input finance-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t(copy.placeholder)}
              aria-label={t('name')}
              maxLength={40}
            />
          </div>

          <div className="finance-color-grid" role="radiogroup" aria-label={t('color')}>
            {FINANCE_COLORS.map((preset) => (
              <label key={preset} className="finance-color-option">
                <input
                  type="radio"
                  name="financeCollectionColor"
                  value={preset}
                  checked={color === preset}
                  onChange={() => setColor(preset)}
                />
                <span style={{ backgroundColor: preset }} />
              </label>
            ))}
          </div>

          <div
            className={`finance-icon-grid${mode === 'account' ? ' finance-icon-grid-compact' : ''}`}
            role="radiogroup"
            aria-label={t('financeIcon')}
          >
            {icons.map(({ key, Icon }) => (
              <label key={key} className="finance-icon-option" title={key}>
                <input
                  type="radio"
                  name="financeCollectionIcon"
                  value={key}
                  checked={icon === key}
                  onChange={() => setIcon(key)}
                />
                <span>
                  <Icon size={18} strokeWidth={2.2} />
                </span>
              </label>
            ))}
          </div>
        </form>

        {items.length > 0 && (
          <section aria-label={t(copy.list)}>
            <h3 className="tag-manage-section-title">{t(copy.list)}</h3>
            <p className="tag-manage-delete-hint">{t(copy.deleteHint)}</p>
            <ul className="finance-category-list">
              {items.map((item) => (
                <li key={item.id} className="finance-category-row">
                  <FinanceIconBadge icon={item.icon} color={item.color} size="sm" />
                  <span className="finance-category-row-name">{item.name}</span>
                  {confirmId === item.id ? (
                    <button
                      type="button"
                      className="finance-category-confirm"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                    >
                      {deletingId === item.id ? t('deleting') : t('delete')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="finance-entry-delete"
                      aria-label={`${t('delete')} ${item.name}`}
                      onClick={() => setConfirmId(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="modal-actions">
          <button
            type="submit"
            form="finance-category-create-form"
            className="modal-action-submit"
            disabled={saving}
          >
            {saving ? t('creating') : t('create')}
          </button>
          <button type="button" className="modal-action-cancel tag-manage-close" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
