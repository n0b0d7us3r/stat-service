import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { FinanceIconBadge } from './FinanceIconBadge';
import { ApiError } from '../api/client';
import { createFinanceCategory, deleteFinanceCategory } from '../api/finance';
import type { FinanceCategory, FinanceEntryKind } from '../types';
import { FINANCE_COLORS } from '../utils/finance';
import { FINANCE_ICONS } from '../utils/financeIcons';
import { t } from '../i18n';

interface FinanceCategoryModalProps {
  kind: FinanceEntryKind;
  categories: FinanceCategory[];
  onClose: () => void;
  onCreated: (category: FinanceCategory) => void;
  onDeleted: (categoryId: number) => void;
}

export function FinanceCategoryModal({ kind, categories, onClose, onCreated, onDeleted }: FinanceCategoryModalProps) {
  const isIncome = kind === 'income';
  const [name, setName] = useState('');
  const [color, setColor] = useState(FINANCE_COLORS[isIncome ? 3 : 5]);
  const [icon, setIcon] = useState(isIncome ? 'wallet' : 'cart');
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
      onCreated(await createFinanceCategory({ kind, name: trimmed, color, icon }));
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeCreateCategoryFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId: number) => {
    setError('');
    setDeletingId(categoryId);

    try {
      await deleteFinanceCategory(categoryId);
      onDeleted(categoryId);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('financeDeleteCategoryFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      title={isIncome ? t('financeSourceManageTitle') : t('financeCategoryManageTitle')}
      isOpen
      onClose={onClose}
      className="glass-modal finance-category-modal"
    >
      <div className="tag-manage-modal">
        {error && <p className="task-editor-error">{error}</p>}

        <form className="task-editor-form tag-manage-create" onSubmit={handleCreate}>
          <div className="finance-category-preview">
            <FinanceIconBadge icon={icon} color={color} size="lg" />
            <input
              type="text"
              className="task-editor-input finance-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isIncome ? t('financeSourceNamePlaceholder') : t('financeCategoryNamePlaceholder')}
              aria-label={t('name')}
              maxLength={40}
            />
          </div>

          <div className="finance-color-grid" role="radiogroup" aria-label={t('color')}>
            {FINANCE_COLORS.map((preset) => (
              <label key={preset} className="finance-color-option">
                <input
                  type="radio"
                  name="financeCategoryColor"
                  value={preset}
                  checked={color === preset}
                  onChange={() => setColor(preset)}
                />
                <span style={{ backgroundColor: preset }} />
              </label>
            ))}
          </div>

          <div className="finance-icon-grid" role="radiogroup" aria-label={t('financeIcon')}>
            {FINANCE_ICONS.map(({ key, Icon }) => (
              <label key={key} className="finance-icon-option" title={key}>
                <input
                  type="radio"
                  name="financeCategoryIcon"
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

          <button type="submit" className="modal-action-submit" disabled={saving}>
            {saving ? t('creating') : t('create')}
          </button>
        </form>

        {categories.length > 0 && (
          <section aria-label={isIncome ? t('financeSources') : t('financeCategories')}>
            <h3 className="tag-manage-section-title">
              {isIncome ? t('financeSources') : t('financeCategories')}
            </h3>
            <p className="tag-manage-delete-hint">
              {isIncome ? t('financeSourceDeleteHint') : t('financeCategoryDeleteHint')}
            </p>
            <ul className="finance-category-list">
              {categories.map((category) => (
                <li key={category.id} className="finance-category-row">
                  <FinanceIconBadge icon={category.icon} color={category.color} size="sm" />
                  <span className="finance-category-row-name">{category.name}</span>
                  {confirmId === category.id ? (
                    <button
                      type="button"
                      className="finance-category-confirm"
                      disabled={deletingId === category.id}
                      onClick={() => void handleDelete(category.id)}
                    >
                      {deletingId === category.id ? t('deleting') : t('delete')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="finance-entry-delete"
                      aria-label={`${t('delete')} ${category.name}`}
                      onClick={() => setConfirmId(category.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" className="modal-action-cancel tag-manage-close" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </Modal>
  );
}
