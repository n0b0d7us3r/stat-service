import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { TaskDescriptionContent } from './TaskDescriptionContent';
import { ApiError } from '../api/client';
import { createTask, updateTask, uploadTaskDescriptionImage } from '../api/tasks';
import type { Tag, Task, TaskPriority } from '../types';
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  descriptionHasImages,
  insertTextAtCursor,
} from '../utils/taskDescription';
import { TASK_PRIORITIES, formatTagName } from '../utils/taskUi';

interface TaskEditorModalProps {
  task: Task | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDelete: (task: Task) => void;
  onArchive?: (task: Task) => void;
}

export function TaskEditorModal({
  task,
  tags,
  onClose,
  onSaved,
  onDelete,
  onArchive,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [detailsEditable, setDetailsEditable] = useState(task === null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
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

  const handleDescriptionPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!detailsEditable || imageUploading) {
      return;
    }

    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) {
      return;
    }

    for (const item of clipboardItems) {
      if (!item.type.startsWith('image/')) {
        continue;
      }

      const file = item.getAsFile();
      if (!file) {
        continue;
      }

      event.preventDefault();
      const textarea = descriptionInputRef.current;
      if (!textarea) {
        return;
      }

      setError('');
      setImageUploading(true);

      void uploadTaskDescriptionImage(file)
        .then(({ url }) => {
          const markdown = `\n![image](${url})\n`;
          insertTextAtCursor(textarea, markdown, setDescription);
        })
        .catch((err: unknown) => {
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить изображение');
        })
        .finally(() => {
          setImageUploading(false);
        });

      return;
    }
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
                <Pencil size={20} />
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

        <div className="task-editor-field">
          <span>Описание</span>
          {locked ? (
            <div className="task-description-view">
              <TaskDescriptionContent value={description} />
            </div>
          ) : (
            <>
              <textarea
                ref={descriptionInputRef}
                className="task-editor-input task-editor-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onPaste={handleDescriptionPaste}
                maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                rows={6}
                placeholder="Текст и изображения (Ctrl+V для вставки картинки из буфера)"
              />
              {imageUploading && (
                <p className="task-description-upload-hint">Загрузка изображения...</p>
              )}
              {descriptionHasImages(description) && (
                <div className="task-description-preview">
                  <span className="task-description-preview-label">Предпросмотр</span>
                  <div className="task-description-view">
                    <TaskDescriptionContent value={description} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {detailsEditable && (
          <div className="task-editor-management">
            <div className="task-editor-split">
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

              <label className="task-editor-field">
                <span>Тег</span>
                <select
                  className="task-editor-select"
                  value={tagIds[0] ? String(tagIds[0]) : ''}
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
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            {task && !task.archived && onArchive && (
              <button
                type="button"
                className="task-editor-archive"
                onClick={() => onArchive(task)}
              >
                Перенести в архив
              </button>
            )}

            {task && (
              <button
                type="button"
                className="task-editor-delete"
                onClick={() => onDelete(task)}
              >
                Удалить задачу
              </button>
            )}
          </div>
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
