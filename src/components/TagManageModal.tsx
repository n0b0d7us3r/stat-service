import { useState } from 'react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createTag, deleteTag } from '../api/tasks';
import type { Tag } from '../types';
import { TAG_COLOR_PRESETS, formatTagName } from '../utils/taskUi';
import { t } from '../i18n';

interface TagManageModalProps {
  tags: Tag[];
  onClose: () => void;
  onCreated: (tag: Tag) => void;
  onDeleted: (tagId: number) => void;
}

export function TagManageModal({ tags, onClose, onCreated, onDeleted }: TagManageModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLOR_PRESETS[4].value);
  const [deleteTagId, setDeleteTagId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('tagNameRequired'));
      return;
    }

    setError('');
    setSaving(true);

    try {
      const created = await createTag(trimmed, color);
      onCreated(created);
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('createTagFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTagId) {
      setError(t('chooseTagToDelete'));
      return;
    }

    setError('');
    setDeleting(true);

    try {
      const tagId = Number(deleteTagId);
      await deleteTag(tagId);
      onDeleted(tagId);
      setDeleteTagId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('deleteTagFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal title={t('tagManageTitle')} isOpen onClose={onClose}>
      <div className="tag-manage-modal">
        {error && <p className="task-editor-error">{error}</p>}

        <form className="task-editor-form tag-manage-create" onSubmit={handleCreate}>
          <h3 className="tag-manage-section-title">{t('createTag')}</h3>

          <label className="task-editor-field">
            <span>{t('name')}</span>
            <span className="tasks-tag-name tag-create-name">
              <span className="tasks-tag-hash" aria-hidden="true">#</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('tagNamePlaceholder')}
                maxLength={32}
                aria-label={t('tagNameAria')}
              />
            </span>
          </label>

          <div className="task-editor-field">
            <span id="tag-color-label">{t('color')}</span>
            <div className="tasks-color-picker" role="radiogroup" aria-labelledby="tag-color-label">
              {TAG_COLOR_PRESETS.map((preset) => (
                <label key={preset.value} className="tasks-color-option" title={preset.label}>
                  <input
                    type="radio"
                    name="tagColor"
                    value={preset.value}
                    checked={color === preset.value}
                    onChange={() => setColor(preset.value)}
                  />
                  <span style={{ backgroundColor: preset.value }} />
                  <span className="visually-hidden">{preset.label}</span>
                </label>
              ))}
            </div>
          </div>

          <ModalActions
            onCancel={onClose}
            submitLabel={t('create')}
            pending={saving}
            pendingLabel={t('creating')}
          />
        </form>

        <section className="tag-manage-delete" aria-labelledby="tag-delete-heading">
          <h3 className="tag-manage-section-title" id="tag-delete-heading">{t('deleteTag')}</h3>
          <p className="tag-manage-delete-hint">
            {t('tagDeleteHint')}
          </p>

          <label className="task-editor-field">
            <span>{t('tag')}</span>
            <select
              className="task-editor-select"
              value={deleteTagId}
              disabled={tags.length === 0 || deleting}
              onChange={(event) => setDeleteTagId(event.target.value)}
            >
              <option value="">{t('chooseTag')}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {formatTagName(tag.name)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="tag-manage-delete-btn"
            disabled={!deleteTagId || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? t('deleting') : t('deleteTag')}
          </button>
        </section>
      </div>
    </Modal>
  );
}
