import { useState } from 'react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createTag } from '../api/tasks';
import type { Tag } from '../types';
import { TAG_COLOR_PRESETS } from '../utils/taskUi';

interface TagCreateModalProps {
  onClose: () => void;
  onCreated: (tag: Tag) => void;
}

export function TagCreateModal({ onClose, onCreated }: TagCreateModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLOR_PRESETS[4].value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
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
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать тег');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Создать тег" isOpen onClose={onClose}>
      <form className="task-editor-form" onSubmit={handleSubmit}>
        {error && <p className="task-editor-error">{error}</p>}

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
              autoFocus
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
    </Modal>
  );
}
