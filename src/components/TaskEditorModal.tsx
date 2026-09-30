import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { ApiError } from '../api/client';
import { createTask, updateTask } from '../api/tasks';
import type { Tag, Task, TaskPriority } from '../types';
import { TASK_PRIORITIES, formatTagName } from '../utils/taskUi';

interface TaskEditorModalProps {
  task: Task | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskEditorModal({
  task,
  tags,
  onClose,
  onSaved,
  onDelete,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [detailsEditable, setDetailsEditable] = useState(task === null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 2);
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [tagIds, setTagIds] = useState<number[]>(task?.tags[0] ? [task.tags[0].id] : []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = !detailsEditable;

  const cancelEditing = () => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setPriority(task?.priority ?? 2);
    setDueDate(task?.due_date ?? '');
    setTagIds(task?.tags[0] ? [task.tags[0].id] : []);
    setError('');
    setDetailsEditable(false);
  };

  const handleEditClick = () => {
    if (!task) return;
    if (detailsEditable) {
      cancelEditing();
      return;
    }

    setDetailsEditable(true);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (task && !detailsEditable) return;

    setError('');
    setSaving(true);

    try {
      const saved = task
        ? await updateTask(task.id, { title, description, priority, dueDate: dueDate || null, tagIds })
        : await createTask({ title, description, priority, dueDate: dueDate || null, tagIds });
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

        <div className="task-editor-field">
          <span className="task-editor-field-head">
            <label htmlFor="task-title">Название</label>
            {task && (
              <button
                type="button"
                className="task-icon-btn task-editor-edit"
                aria-pressed={detailsEditable}
                aria-label={detailsEditable ? 'Отменить редактирование' : 'Редактировать задачу'}
                onClick={handleEditClick}
              >
                <Pencil size={16} />
              </button>
            )}
          </span>
          <input
            id="task-title"
            ref={titleInputRef}
            type="text"
            className="task-editor-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            disabled={locked}
            autoFocus={detailsEditable}
          />
        </div>

        <label className="task-editor-field">
          <span>Описание</span>
          <textarea
            className="task-editor-input task-editor-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            disabled={locked}
          />
        </label>

        <div className="task-editor-split">
          <label className="task-editor-field">
            <span>Приоритет</span>
            <select
              className="task-editor-select"
              value={priority}
              disabled={locked}
              onChange={(event) => setPriority(Number(event.target.value) as TaskPriority)}
            >
              {TASK_PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="task-editor-field">
            <span>Тег</span>
            <select
              className="task-editor-select"
              value={tagIds[0] ? String(tagIds[0]) : ''}
              disabled={locked}
              onChange={(event) => {
                const value = event.target.value;
                setTagIds(value ? [Number(value)] : []);
              }}
            >
              <option value="">Без тега</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {formatTagName(tag.name)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="task-editor-field">
          <span>Дата выполнения</span>
          <input
            type="date"
            className="task-editor-input task-editor-date"
            value={dueDate}
            disabled={locked}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>

        {task && (
          <button type="button" className="task-editor-delete" onClick={() => onDelete(task)}>
            Удалить задачу
          </button>
        )}

        <ModalActions
          onCancel={onClose}
          submitLabel={task ? 'Сохранить' : 'Создать'}
          pending={saving}
          submitDisabled={Boolean(task) && !detailsEditable}
        />
      </form>
    </Modal>
  );
}
