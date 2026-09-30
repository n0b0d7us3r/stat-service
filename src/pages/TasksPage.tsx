import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUp, ListTodo, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ModalActions } from '../components/ModalActions';
import { PageTitle } from '../components/PageTitle';
import { SortSelect } from '../components/SortSelect';
import { TaskEditorModal } from '../components/TaskEditorModal';
import { APP_NAME } from '../config/app';
import { ApiError } from '../api/client';
import { deleteTask, getTaskBoard, updateTask } from '../api/tasks';
import type { Tag, Task, TaskPriority, TaskSortMode } from '../types';
import { compareTasks, formatTagName, priorityLabel, tagChipStyle } from '../utils/taskUi';
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
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
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

  const handleDeleteTask = async () => {
    if (!taskToDelete || pendingTaskId === taskToDelete.id) return;
    const taskId = taskToDelete.id;
    setPendingTaskId(taskId);
    setError('');

    try {
      await deleteTask(taskId);
      setTasks((current) => current.filter((item) => item.id !== taskId));
      setTaskToDelete(null);
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

            <SortSelect
              value={sort}
              options={[
                { value: 'priority', label: 'По приоритету' },
                { value: 'created', label: 'По дате' },
              ]}
              onChange={setSort}
            />

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
                    onDelete={setTaskToDelete}
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
                    onDelete={setTaskToDelete}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>

      {taskToDelete && (
        <Modal
          title="Удалить задачу"
          isOpen
          onClose={() => {
            if (pendingTaskId === taskToDelete.id) return;
            setTaskToDelete(null);
          }}
        >
          <form
            className="task-delete-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleDeleteTask();
            }}
          >
            <p>Удалить «{taskToDelete.title}»?</p>
            <ModalActions
              onCancel={() => {
                if (pendingTaskId === taskToDelete.id) return;
                setTaskToDelete(null);
              }}
              submitLabel="Удалить"
              pending={pendingTaskId === taskToDelete.id}
              pendingLabel="Удаление..."
            />
          </form>
        </Modal>
      )}

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

const PRIORITY_ICONS = {
  1: ArrowDown,
  2: Minus,
  3: ArrowUp,
  4: ChevronsUp,
} as const;

function PriorityIcon({ priority }: { priority: TaskPriority }) {
  const Icon = PRIORITY_ICONS[priority];
  const label = priorityLabel(priority);

  return (
    <span className={`task-priority-icon task-priority-icon-${priority}`} title={label} aria-label={label}>
      <Icon size={18} strokeWidth={2.5} />
    </span>
  );
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
              {task.tags.map((tag) => (
                <span key={tag.id} className="task-title-tag" style={{ color: tag.color }}>
                  [ {formatTagName(tag.name)} ]{' '}
                </span>
              ))}
              <span className="task-title-text">{task.title}</span>
            </button>
            {task.completed && task.completed_at && (
              <time className="task-card-completed-at" dateTime={task.completed_at}>
                {formatCompletedAt(task.completed_at)}
              </time>
            )}
          </div>
          <div className="task-card-side">
            <PriorityIcon priority={task.priority} />
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
        </div>

        {task.tags.length > 0 && (
          <div className="task-card-tags">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="task-tag"
                style={tagChipStyle(tag.color)}
              >
                #{formatTagName(tag.name)}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
