import { useCallback, useEffect, useState } from 'react';
import { ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { TaskEditorModal } from '../components/TaskEditorModal';
import { APP_NAME } from '../config/app';
import { ApiError } from '../api/client';
import { deleteTask, getTaskBoard, updateTask } from '../api/tasks';
import type { Tag, Task, TaskSortMode } from '../types';
import { compareTasks, priorityLabel, tagChipStyle } from '../utils/taskUi';
import '../styles/TasksPage.css';

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatCompletedAt(value: string): string {
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return value;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `Выполнено ${label}`;
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

  const handleTagCreated = (tag: Tag) => {
    setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  };

  const handleTagDeleted = (tagId: number) => {
    setTags((current) => current.filter((item) => item.id !== tagId));
    setTasks((current) => current.map((task) => ({
      ...task,
      tags: task.tags.filter((item) => item.id !== tagId),
    })));
    setEditorTask((current) => (current
      ? { ...current, tags: current.tags.filter((item) => item.id !== tagId) }
      : current));
  };

  return (
    <Layout>
      <div className="tasks-page">
        <div className="tasks-page-intro">
          <PageTitle
            title="Задачи"
            subtitle={loading ? 'Загрузка...' : `Активных: ${activeTasks.length} · Выполненных: ${completedTasks.length}`}
          />
          <div className="tasks-controls">
            <button type="button" className="tasks-create-btn" onClick={openCreate}>
              <Plus size={20} strokeWidth={2.5} />
              <span>Новая задача</span>
            </button>

            <label className="tasks-sort-field">
              <span>Сортировка</span>
              <select
                className="tasks-sort-select"
                value={sort}
                aria-label="Сортировка"
                onChange={(event) => setSort(event.target.value as TaskSortMode)}
              >
                <option value="priority">По приоритету</option>
                <option value="created">По дате</option>
              </select>
            </label>

            <label className="tasks-completed-field">
              <span>Выполненные:</span>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
              />
            </label>
          </div>
        </div>

        {error && <p className="tasks-error">{error}</p>}

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
                <p>Активных задач нет. Отметьте «Выполненные», чтобы увидеть их.</p>
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
          onTagCreated={handleTagCreated}
          onTagDeleted={handleTagDeleted}
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
          <div className="task-card-heading">
            <button type="button" className="task-card-title" onClick={() => onEdit(task)}>
              {task.title}
            </button>
            {task.completed && task.completed_at && (
              <time className="task-card-completed-at" dateTime={task.completed_at}>
                {formatCompletedAt(task.completed_at)}
              </time>
            )}
          </div>
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

        {task.description && (
          <p className="task-card-description">{task.description}</p>
        )}

        {task.tags.length > 0 && (
          <div className="task-card-tags">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="task-tag"
                style={tagChipStyle(tag.color)}
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
