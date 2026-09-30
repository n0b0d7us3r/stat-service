import { useState } from 'react';
import { Modal } from './Modal';
import { ApiError } from '../api/client';
import { createTask, updateTask } from '../api/tasks';
import type { Tag, Task, TaskPriority } from '../types';
import { TASK_PRIORITIES, tagForeground } from '../utils/taskUi';

interface TaskEditorModalProps {
  task: Task | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: (task: Task) => void;
}

export function TaskEditorModal({ task, tags, onClose, onSaved }: TaskEditorModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 2);
  const [tagIds, setTagIds] = useState<number[]>(task?.tags.map((item) => item.id) ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const saved = task
        ? await updateTask(task.id, { title, priority, tagIds })
        : await createTask({ title, priority, tagIds });
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
          <span>Название</span>
          <input
            type="text"
            className="task-editor-input"
            placeholder="Что нужно сделать"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            autoFocus
          />
        </label>

        <fieldset className="task-editor-fieldset">
          <legend>Приоритет</legend>
          <div className="task-priority-options" role="radiogroup" aria-label="Приоритет">
            {TASK_PRIORITIES.map((item) => (
              <label
                key={item.value}
                className={`task-priority-option task-priority-option-${item.value} ${priority === item.value ? 'task-priority-option-active' : ''}`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={item.value}
                  checked={priority === item.value}
                  onChange={() => setPriority(item.value)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="task-editor-fieldset">
          <legend>Теги</legend>
          {tags.length === 0 ? (
            <p className="task-editor-hint">Тегов пока нет. Создайте их в блоке «Теги» на странице.</p>
          ) : (
            <div className="task-tag-picker">
              {tags.map((tag) => {
                const selected = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`task-tag task-tag-button ${selected ? 'task-tag-selected' : ''}`}
                    style={{ backgroundColor: tag.color, color: tagForeground(tag.color) }}
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag.id)}
                  >
                    #{tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="task-editor-actions">
          <button type="button" className="task-editor-cancel" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="task-editor-submit" disabled={saving}>
            {saving ? 'Сохранение...' : task ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
