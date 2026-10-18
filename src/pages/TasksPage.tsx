import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, ChevronsUp, ListTodo, Minus, Pencil, Tag as TagIcon } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ModalActions } from '../components/ModalActions';
import { Checkbox } from '../components/Checkbox';
import { PageTitle } from '../components/PageTitle';
import { SortSelect } from '../components/SortSelect';
import { TaskEditorModal } from '../components/TaskEditorModal';
import { Vaporize, type VaporizeHandle } from '../components/Vaporize';
import { TagManageModal } from '../components/TagManageModal';
import { TaskArchiveModal } from '../components/TaskArchiveModal';
import { TaskActivityCalendar } from '../components/TaskActivityCalendar';
import { APP_NAME } from '../config/app';
import { ApiError } from '../api/client';
import { deleteTask, getTaskBoard, updateTask } from '../api/tasks';
import type { Tag, Task, TaskPriority, TaskSortMode } from '../types';
import { formatLocalDate } from '../utils/date';
import { compareTasks, formatTagName, isTaskOverdue, priorityLabel } from '../utils/taskUi';
import '../styles/TasksPage.css';

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatTaskDate(value: string): string {
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return value;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCompletedAt(value: string): string {
  const label = formatTaskDate(value);
  return label === value ? value : `Выполнено ${label}`;
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<TaskSortMode>('created');
  const [tagFilter, setTagFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tagManageOpen, setTagManageOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
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

  const boardTasks = tasks.filter((task) => !task.archived);
  const archivedCount = tasks.filter((task) => task.archived).length;
  const visibleTasks = tagFilter === 'all'
    ? boardTasks
    : boardTasks.filter((task) => task.tags.some((tag) => String(tag.id) === tagFilter));
  const activeTasks = visibleTasks
    .filter((task) => !task.completed)
    .sort((a, b) => compareTasks(a, b, sort));
  const completedTasks = visibleTasks
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
    setTags((current) => current.filter((tag) => tag.id !== tagId));
    setTasks((current) => current.map((task) => (
      task.tags.some((tag) => tag.id === tagId)
        ? { ...task, tags: task.tags.filter((tag) => tag.id !== tagId) }
        : task
    )));
    if (tagFilter === String(tagId)) {
      setTagFilter('all');
    }
  };

  const handleArchiveTask = async (task: Task) => {
    if (pendingTaskId === task.id) return;
    setPendingTaskId(task.id);
    setError('');

    try {
      const updated = await updateTask(task.id, { archived: true });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditorOpen(false);
      setEditorTask(null);
    } catch (err) {
      setError(errorText(err, 'Не удалось перенести задачу в архив'));
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <Layout>
      <div className="tasks-page">
        <div className="tasks-page-intro">
          <PageTitle
            title="Задачи"
            subtitle={loading
              ? 'Загрузка...'
              : `Активных: ${activeTasks.length} · Выполненных: ${completedTasks.length}${archivedCount > 0 ? ` · В архиве: ${archivedCount}` : ''}`}
          />
          <div className="tasks-controls">
            <button type="button" className="tasks-create-btn" onClick={openCreate}>
              <span>Создать задачу</span>
            </button>

            <button type="button" className="tasks-tag-create-btn" onClick={() => setTagManageOpen(true)}>
              <TagIcon size={18} strokeWidth={2.25} />
              <span>Теги</span>
            </button>

            <button type="button" className="tasks-archive-btn" onClick={() => setArchiveOpen(true)}>
              <Archive size={18} strokeWidth={2.25} />
              <span>Архив{archivedCount > 0 ? ` (${archivedCount})` : ''}</span>
            </button>

            <div className="tasks-sorts">
              <SortSelect
                value={sort}
                options={[
                  { value: 'created', label: 'По дням' },
                  { value: 'priority', label: 'По приоритету' },
                ]}
                onChange={setSort}
              />

              <SortSelect
                label="По тегам"
                value={tagFilter}
                options={[
                  { value: 'all', label: 'Все теги' },
                  ...tags.map((tag) => ({ value: String(tag.id), label: formatTagName(tag.name) })),
                ]}
                onChange={setTagFilter}
              />
            </div>

            <Checkbox
              className="tasks-completed-toggle"
              checked={showCompleted}
              onChange={setShowCompleted}
              label="Выполненные"
            />
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
          <div className="tasks-workspace">
            <div className="tasks-workspace-main">
          <div className="tasks-groups">
            {activeTasks.length === 0 && completedTasks.length === 0 && (
              <div className="tasks-empty app-border-card">
                <ListTodo size={40} aria-hidden="true" />
                <p>Нет задач с этим тегом.</p>
              </div>
            )}

            {activeTasks.length === 0 && completedTasks.length > 0 && !showCompleted && (
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
                  />
                ))}
              </section>
            )}
          </div>
            </div>
            <TaskActivityCalendar tasks={boardTasks} />
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
          onDelete={(task) => {
            setEditorOpen(false);
            setEditorTask(null);
            setTaskToDelete(task);
          }}
          onArchive={(task) => void handleArchiveTask(task)}
        />
      )}

      {tagManageOpen && (
        <TagManageModal
          tags={tags}
          onClose={() => setTagManageOpen(false)}
          onCreated={handleTagCreated}
          onDeleted={handleTagDeleted}
        />
      )}

      {archiveOpen && (
        <TaskArchiveModal
          tasks={tasks}
          onClose={() => setArchiveOpen(false)}
          onTaskUpdated={(task) => {
            setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
          }}
          onTaskDeleted={(taskId) => {
            setTasks((current) => current.filter((item) => item.id !== taskId));
          }}
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
      <Icon size={12} strokeWidth={2.25} />
    </span>
  );
}

function TaskCard({ task, pending, onToggle, onEdit }: TaskCardProps) {
  const vaporRef = useRef<VaporizeHandle>(null);
  const leavingRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const todayKey = formatLocalDate(new Date());
  const isOverdue = isTaskOverdue(task, todayKey);

  const handleCheck = () => {
    if (pending || leavingRef.current) return;
    if (!task.completed) {
      leavingRef.current = true;
      setLeaving(true);
      void vaporRef.current?.play().finally(() => onToggle(task));
      return;
    }
    onToggle(task);
  };

  return (
    <Vaporize ref={vaporRef}>
      <article className={`task-card app-border-card task-card-priority-${task.priority} ${task.completed ? 'task-card-completed' : ''}`}>
        <Checkbox
          className="task-check"
          checked={task.completed}
          disabled={pending || leaving}
          ariaLabel={task.completed ? `Вернуть «${task.title}» в активные` : `Отметить «${task.title}» выполненной`}
          onChange={handleCheck}
        />

        <div className="task-card-body">
          <div className="task-card-title-slot">
            <button type="button" className="task-card-title" title={task.title} onClick={() => onEdit(task)}>
              {task.tags[0] && (
                <>
                  <span className="task-title-tag" style={{ color: task.tags[0].color }}>
                    [ {formatTagName(task.tags[0].name)} ]
                  </span>
                  <span className="task-title-sep"> / </span>
                </>
              )}
              <span className="task-title-text">{task.title}</span>
            </button>
          </div>
          <p className="task-card-due">
            <PriorityIcon priority={task.priority} />
            {!task.completed && (
              task.due_date
                ? (
                  <time
                    dateTime={task.due_date}
                    className={isOverdue ? 'task-card-due-overdue' : undefined}
                  >
                    {formatTaskDate(task.due_date)}
                  </time>
                )
                : <span>-- / -- / 20--</span>
            )}
            {task.completed && task.completed_at && (
              <time className="task-card-completed-at" dateTime={task.completed_at}>
                {formatCompletedAt(task.completed_at)}
              </time>
            )}
          </p>
        </div>

        <button
          type="button"
          className="task-icon-btn task-card-edit"
          aria-label={`Изменить «${task.title}»`}
          onClick={() => onEdit(task)}
        >
          <Pencil size={20} />
        </button>
      </article>
    </Vaporize>
  );
}
