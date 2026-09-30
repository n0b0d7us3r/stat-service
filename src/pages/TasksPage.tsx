import { useCallback, useEffect, useState } from 'react';
import { ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { TaskEditorModal } from '../components/TaskEditorModal';
import { APP_NAME } from '../config/app';
import { ApiError } from '../api/client';
import { createTag, deleteTag, deleteTask, getTaskBoard, updateTask } from '../api/tasks';
import type { Tag, Task, TaskSortMode } from '../types';
import { TAG_COLOR_PRESETS, compareTasks, priorityLabel, tagForeground } from '../utils/taskUi';
import '../styles/TasksPage.css';

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<TaskSortMode>('priority');
  const [showCompleted, setShowCompleted] = useState(false);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLOR_PRESETS[2].value);
  const [tagError, setTagError] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);

  const loadBoard = useCallback(async () => {
    const board = await getTaskBoard();
    setTasks(board.tasks);
    setTags(board.tags);
  }, []);

  useEffect(() => {
    document.title = `Задачи | ${APP_NAME}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadBoard()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorText(err, 'Не удалось загрузить задачи'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadBoard]);

  const activeTasks = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => compareTasks(a, b, sort));
  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort((a, b) => compareTasks(a, b, sort));

  const openCreate = () => {
    setEditorTask(null);
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditorTask(task);
    setEditorOpen(true);
  };

  const handleSaved = (task: Task) => {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      if (!exists) {
        return [task, ...current];
      }
      return current.map((item) => (item.id === task.id ? task : item));
    });
    setEditorOpen(false);
    setEditorTask(null);
  };

  const handleToggle = async (task: Task) => {
    if (pendingTaskId === task.id) return;
    setPendingTaskId(task.id);
    setError('');
    const nextCompleted = !task.completed;
    setTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, completed: nextCompleted } : item
    )));

    try {
      const updated = await updateTask(task.id, { completed: nextCompleted });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      setError(errorText(err, 'Не удалось обновить задачу'));
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (pendingTaskId === task.id) return;
    setPendingTaskId(task.id);
    setError('');

    try {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      setError(errorText(err, 'Не удалось удалить задачу'));
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleCreateTag = async (event: React.FormEvent) => {
    event.preventDefault();
    setTagError('');
    setTagSaving(true);

    try {
      const tag = await createTag(tagName, tagColor);
      setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
      setTagName('');
    } catch (err) {
      setTagError(errorText(err, 'Не удалось создать тег'));
    } finally {
      setTagSaving(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    setTagError('');
    setError('');

    try {
      await deleteTag(tag.id);
      setTags((current) => current.filter((item) => item.id !== tag.id));
      setTasks((current) => current.map((task) => ({
        ...task,
        tags: task.tags.filter((item) => item.id !== tag.id),
      })));
    } catch (err) {
      setError(errorText(err, 'Не удалось удалить тег'));
    }
  };

  return (
    <Layout>
      <div className="tasks-page">
        <div className="tasks-page-intro">
          <PageTitle
            title="Задачи"
            subtitle={loading ? 'Загрузка...' : `Активных: ${activeTasks.length} · Выполненных: ${completedTasks.length}`}
          />
          <button type="button" className="tasks-create-btn" onClick={openCreate}>
            <Plus size={20} strokeWidth={2.5} />
            <span>Новая задача</span>
          </button>
        </div>

        <div className="tasks-toolbar">
          <div className="tasks-sort-toggle" role="group" aria-label="Сортировка задач">
            <button
              type="button"
              className={`tasks-sort-btn ${sort === 'priority' ? 'tasks-sort-btn-active' : ''}`}
              aria-pressed={sort === 'priority'}
              onClick={() => setSort('priority')}
            >
              По приоритету
            </button>
            <button
              type="button"
              className={`tasks-sort-btn ${sort === 'created' ? 'tasks-sort-btn-active' : ''}`}
              aria-pressed={sort === 'created'}
              onClick={() => setSort('created')}
            >
              По дате
            </button>
          </div>

          <button
            type="button"
            className={`tasks-completed-toggle ${showCompleted ? 'tasks-completed-toggle-active' : ''}`}
            aria-pressed={showCompleted}
            onClick={() => setShowCompleted((value) => !value)}
          >
            {showCompleted ? 'Скрыть выполненные' : 'Показать выполненные'}
            {completedTasks.length > 0 ? ` (${completedTasks.length})` : ''}
          </button>
        </div>

        {error && <p className="tasks-error">{error}</p>}

        <section className="tasks-tags app-border-card" aria-labelledby="tasks-tags-title">
          <h2 id="tasks-tags-title" className="tasks-section-title">Теги</h2>
          <p className="tasks-tags-hint">Свои метки вроде #работа, #машина, #здоровье. У каждого тега свой цвет.</p>

          {tags.length > 0 && (
            <div className="tasks-tag-list">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="task-tag"
                  style={{ backgroundColor: tag.color, color: tagForeground(tag.color) }}
                >
                  #{tag.name}
                  <button
                    type="button"
                    className="task-tag-remove"
                    aria-label={`Удалить тег ${tag.name}`}
                    onClick={() => void handleDeleteTag(tag)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form className="tasks-tag-form" onSubmit={handleCreateTag}>
            <label className="tasks-tag-name">
              <span className="tasks-tag-hash" aria-hidden="true">#</span>
              <input
                type="text"
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="название"
                maxLength={32}
                aria-label="Название тега"
                required
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

            <button type="submit" className="tasks-tag-submit" disabled={tagSaving}>
              {tagSaving ? '...' : 'Добавить'}
            </button>
          </form>
          {tagError && <p className="tasks-error">{tagError}</p>}
        </section>

        {loading && tasks.length === 0 ? (
          <p className="tasks-placeholder">Загрузка задач...</p>
        ) : tasks.length === 0 ? (
          <div className="tasks-empty app-border-card">
            <ListTodo size={40} aria-hidden="true" />
            <p>Задач пока нет. Создайте первую и отметьте её тегами.</p>
          </div>
        ) : (
          <div className="tasks-groups">
            {activeTasks.length === 0 && !showCompleted && (
              <div className="tasks-empty app-border-card">
                <ListTodo size={40} aria-hidden="true" />
                <p>Активных задач нет. Выполненные можно показать кнопкой выше.</p>
              </div>
            )}

            {activeTasks.length > 0 && (
              <section className="tasks-list" aria-label="Активные задачи">
                {activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    pending={pendingTaskId === task.id}
                    onToggle={handleToggle}
                    onEdit={openEdit}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </section>
            )}

            {showCompleted && completedTasks.length > 0 && (
              <section className="tasks-list" aria-label="Выполненные задачи">
                <h2 className="tasks-section-title">Выполненные</h2>
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    pending={pendingTaskId === task.id}
                    onToggle={handleToggle}
                    onEdit={openEdit}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>

      {editorOpen && (
        <TaskEditorModal
          key={editorTask?.id ?? 'create'}
          task={editorTask}
          tags={tags}
          onClose={() => {
            setEditorOpen(false);
            setEditorTask(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </Layout>
  );
}

interface TaskCardProps {
  task: Task;
  pending: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskCard({ task, pending, onToggle, onEdit, onDelete }: TaskCardProps) {
  return (
    <article className={`task-card app-border-card task-card-priority-${task.priority} ${task.completed ? 'task-card-completed' : ''}`}>
      <label className="task-check">
        <input
          type="checkbox"
          checked={task.completed}
          disabled={pending}
          aria-label={task.completed ? `Вернуть «${task.title}» в активные` : `Отметить «${task.title}» выполненной`}
          onChange={() => onToggle(task)}
        />
      </label>

      <div className="task-card-body">
        <div className="task-card-top">
          <button type="button" className="task-card-title" onClick={() => onEdit(task)}>
            {task.title}
          </button>
          <span className={`task-priority-badge task-priority-badge-${task.priority}`}>
            {priorityLabel(task.priority)}
          </span>
          <div className="task-card-actions">
            <button
              type="button"
              className="task-icon-btn"
              aria-label={`Изменить «${task.title}»`}
              onClick={() => onEdit(task)}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="task-icon-btn task-icon-btn-danger"
              aria-label={`Удалить «${task.title}»`}
              disabled={pending}
              onClick={() => onDelete(task)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {task.tags.length > 0 && (
          <div className="task-card-tags">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="task-tag"
                style={{ backgroundColor: tag.color, color: tagForeground(tag.color) }}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
