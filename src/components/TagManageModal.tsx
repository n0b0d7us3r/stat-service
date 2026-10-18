import { useState } from 'react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createTag, deleteTag } from '../api/tasks';
import type { Tag } from '../types';
import { TAG_COLOR_PRESETS, formatTagName } from '../utils/taskUi';

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
      setError('Укажите название тега');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const created = await createTag(trimmed, color);
      onCreated(created);
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать тег');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTagId) {
      setError('Выберите тег для удаления');
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
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить тег');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal title="Управление тегами" isOpen onClose={onClose}>
      <div className="tag-manage-modal">
        {error && <p className="task-editor-error">{error}</p>}

        <form className="task-editor-form tag-manage-create" onSubmit={handleCreate}>
          <h3 className="tag-manage-section-title">Создать тег</h3>

          <label className="task-editor-field">
            <span>Название</span>
            <span className="tasks-tag-name tag-create-name">
              <span className="tasks-tag-hash" aria-hidden="true">#</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="название"
                maxLength={32}
                aria-label="Название тега"
              />
            </span>
          </label>

          <div className="task-editor-field">
            <span id="tag-color-label">Цвет</span>
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
            submitLabel="Создать"
            pending={saving}
            pendingLabel="Создание..."
          />
        </form>

        <section className="tag-manage-delete" aria-labelledby="tag-delete-heading">
          <h3 className="tag-manage-section-title" id="tag-delete-heading">Удалить тег</h3>
          <p className="tag-manage-delete-hint">
            Задачи с этим тегом останутся без тега.
          </p>

          <label className="task-editor-field">
            <span>Тег</span>
            <select
              className="task-editor-select"
              value={deleteTagId}
              disabled={tags.length === 0 || deleting}
              onChange={(event) => setDeleteTagId(event.target.value)}
            >
              <option value="">Выберите тег</option>
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
            {deleting ? 'Удаление...' : 'Удалить тег'}
          </button>
        </section>
      </div>
    </Modal>
  );
}
