import { useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createTag, createTask, updateTask } from '../api/tasks';
import type { Tag, Task, TaskPriority } from '../types';
import { TAG_COLOR_PRESETS, TASK_PRIORITIES, formatTagName, tagChipStyle } from '../utils/taskUi';

interface TaskEditorModalProps {
  task: Task | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onTagCreated: (tag: Tag) => void;
}

export function TaskEditorModal({
  task,
  tags,
  onClose,
  onSaved,
  onTagCreated,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [detailsEditable, setDetailsEditable] = useState(task === null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 2);
  const [tagIds, setTagIds] = useState<number[]>(task?.tags.map((item) => item.id) ?? []);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLOR_PRESETS[5].value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);

  const toggleTag = (tagId: number) => {
    setTagIds((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }
      if (current.length >= 10) {
        return current;
      }
      return [...current, tagId];
    });
  };

  const handleCreateTag = async () => {
    const name = tagName.trim();
    if (!name) {
      setError('Укажите название тега');
      return;
    }

    setError('');
    setTagSaving(true);

    try {
      const created = await createTag(name, tagColor);
      onTagCreated(created);
      setTagIds((current) => (current.includes(created.id) || current.length >= 10
        ? current
        : [...current, created.id]));
      setTagName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать тег');
    } finally {
      setTagSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const saved = task
        ? await updateTask(task.id, { title, description, priority, tagIds })
        : await createTask({ title, description, priority, tagIds });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить задачу');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={task ? 'Задача' : 'Новая задача'} isOpen onClose={onClose}>
      <form className="task-editor-form" onSubmit={handleSubmit}>
        {error && <p className="task-editor-error">{error}</p>}

        <label className="task-editor-field">
          <span className="task-editor-field-head">
            <span>Название</span>
            {task && !detailsEditable && (
              <button
                type="button"
                className="task-icon-btn"
                aria-label="Редактировать название и описание"
                onClick={() => {
                  setDetailsEditable(true);
                  requestAnimationFrame(() => titleInputRef.current?.focus());
                }}
              >
                <Pencil size={16} />
              </button>
            )}
          </span>
          <input
            ref={titleInputRef}
            type="text"
            className="task-editor-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            readOnly={!detailsEditable}
            autoFocus={detailsEditable}
          />
        </label>

        <label className="task-editor-field">
          <span>Описание</span>
          <textarea
            className="task-editor-input task-editor-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            readOnly={!detailsEditable}
          />
        </label>

        <label className="task-editor-field">
          <span>Приоритет</span>
          <select
            className="task-editor-select"
            value={priority}
            onChange={(event) => setPriority(Number(event.target.value) as TaskPriority)}
          >
            {TASK_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="task-editor-fieldset">
          <legend>Теги</legend>
          {tags.length > 0 && (
            <div className="task-tag-picker">
              {tags.map((tag) => {
                const selected = tagIds.includes(tag.id);
                return (
                  <span
                    key={tag.id}
                    className={`task-tag ${selected ? 'task-tag-selected' : ''}`}
                    style={tagChipStyle(tag.color)}
                  >
                    <button
                      type="button"
                      className="task-tag-pick"
                      aria-pressed={selected}
                      onClick={() => toggleTag(tag.id)}
                    >
                      #{formatTagName(tag.name)}
                    </button>
                    {selected && (
                      <button
                        type="button"
                        className="task-tag-remove"
                        aria-label={`Снять тег ${formatTagName(tag.name)} с задачи`}
                        onClick={() => toggleTag(tag.id)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <div className="tasks-tag-form">
            <label className="tasks-tag-name">
              <span className="tasks-tag-hash" aria-hidden="true">#</span>
              <input
                type="text"
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleCreateTag();
                  }
                }}
                placeholder="название"
                maxLength={32}
                aria-label="Название тега"
              />
            </label>

            <div className="tasks-color-picker" role="radiogroup" aria-label="Цвет тега">
              {TAG_COLOR_PRESETS.map((preset) => (
                <label key={preset.value} className="tasks-color-option" title={preset.label}>
                  <input
                    type="radio"
                    name="tagColor"
                    value={preset.value}
                    checked={tagColor === preset.value}
                    onChange={() => setTagColor(preset.value)}
                  />
                  <span style={{ backgroundColor: preset.value }} />
                  <span className="visually-hidden">{preset.label}</span>
                </label>
              ))}
            </div>

            <button type="button" className="tasks-tag-submit" disabled={tagSaving} onClick={() => void handleCreateTag()}>
              {tagSaving ? '...' : 'Добавить'}
            </button>
          </div>
        </fieldset>

        <ModalActions
          onCancel={onClose}
          submitLabel={task ? 'Сохранить' : 'Создать'}
          pending={saving}
        />
      </form>
    </Modal>
  );
}
