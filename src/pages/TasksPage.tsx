import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Archive, ArrowDown, ArrowUp, ChevronsUp, FolderClosed, ListTodo, Minus, Pencil, Tag as TagIcon } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ModalActions } from '../components/ModalActions';
import { Checkbox } from '../components/Checkbox';
import { SortSelect } from '../components/SortSelect';
import { TaskEditorModal } from '../components/TaskEditorModal';
import { Vaporize, type VaporizeHandle } from '../components/Vaporize';
import { TagManageModal } from '../components/TagManageModal';
import { TaskArchiveModal } from '../components/TaskArchiveModal';
import { TaskFolders } from '../components/TaskFolders';
import { TaskActivityCalendar } from '../components/TaskActivityCalendar';
import { APP_NAME } from '../config/app';
import { ApiError } from '../api/client';
import { createFolder, deleteFolder, deleteTask, getTaskBoard, updateTask } from '../api/tasks';
import type { Folder, Tag, Task, TaskPriority, TaskSortMode } from '../types';
import { formatLocalDate } from '../utils/date';
import { dateLocaleTag, t } from '../i18n';
import { notifyTaskBoardChanged } from '../utils/taskBoardEvents';
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
  return new Date(year, month - 1, day).toLocaleDateString(dateLocaleTag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCompletedAt(value: string): string {
  const label = formatTaskDate(value);
  return label === value ? value : t('completedOn', { label });
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);
  const [folderMotion, setFolderMotion] = useState<'in' | 'out' | null>(null);
  const folderCloseTimer = useRef<number | null>(null);
  const foldersPanelObserver = useRef<ResizeObserver | null>(null);
  const foldersPanelRef = useCallback((panel: HTMLElement | null) => {
    foldersPanelObserver.current?.disconnect();
    foldersPanelObserver.current = null;
    const workspace = panel?.closest<HTMLElement>('.tasks-workspace');
    if (!panel || !workspace) return;
    const observer = new ResizeObserver(() => {
      workspace.style.setProperty('--task-folders-panel-height', `${panel.offsetHeight}px`);
    });
    observer.observe(panel);
    foldersPanelObserver.current = observer;
  }, []);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
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
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  ));

  const loadBoard = useCallback(async () => {
    const board = await getTaskBoard();
    setTasks(board.tasks);
    setTags(board.tags);
    setFolders(board.folders);
  }, []);

  useEffect(() => {
    document.title = `${t('tasksTitle')} | ${APP_NAME}`;
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const syncLayout = () => {
      setMobileLayout(media.matches);
      if (!media.matches) {
        setMobileSummaryOpen(false);
      }
    };
    syncLayout();
    media.addEventListener('change', syncLayout);
    return () => media.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => () => {
    if (folderCloseTimer.current) {
      window.clearTimeout(folderCloseTimer.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadBoard()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorText(err, t('loadTasksFailed')));
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
  const openFolder = folders.find((folder) => folder.id === openFolderId) ?? null;
  const taggedTasks = tagFilter === 'all'
    ? boardTasks
    : boardTasks.filter((task) => task.tags.some((tag) => String(tag.id) === tagFilter));
  const visibleTasks = openFolder
    ? taggedTasks.filter((task) => task.folder_id === openFolder.id)
    : taggedTasks.filter((task) => task.folder_id == null);
  const summaryActiveCount = taggedTasks.filter((task) => !task.completed).length;
  const summaryCompletedCount = taggedTasks.filter((task) => task.completed).length;
  const activeTasks = visibleTasks
    .filter((task) => !task.completed)
    .sort((a, b) => compareTasks(a, b, sort));
  const completedTasks = visibleTasks
    .filter((task) => task.completed)
    .sort((a, b) => {
      const aDone = a.completed_at ?? '';
      const bDone = b.completed_at ?? '';
      if (aDone !== bDone) {
        return aDone < bDone ? 1 : -1;
      }
      return b.id - a.id;
    });

  const openCreate = () => {
    setEditorTask(null);
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditorTask(task);
    setEditorOpen(true);
  };

  const handleSaved = (task: Task, options?: { keepOpen?: boolean }) => {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      if (!exists) {
        return [task, ...current];
      }
      return current.map((item) => (item.id === task.id ? task : item));
    });
    if (options?.keepOpen) {
      setEditorTask(task);
      notifyTaskBoardChanged();
      return;
    }
    setEditorOpen(false);
    setEditorTask(null);
    notifyTaskBoardChanged();
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
      notifyTaskBoardChanged();
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      setError(errorText(err, t('updateTaskFailed')));
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
      notifyTaskBoardChanged();
    } catch (err) {
      setError(errorText(err, t('deleteTaskFailed')));
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleTagCreated = (tag: Tag) => {
    setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name, dateLocaleTag)));
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

  const taskSummaryText = loading
    ? t('loading')
    : archivedCount > 0
      ? t('tasksSummaryArchive', {
        active: summaryActiveCount,
        completed: summaryCompletedCount,
        archived: archivedCount,
      })
      : t('tasksSummary', { active: summaryActiveCount, completed: summaryCompletedCount });

  const handleArchiveTask = async (task: Task) => {
    if (pendingTaskId === task.id) return;
    setPendingTaskId(task.id);
    setError('');

    try {
      const updated = await updateTask(task.id, { archived: true });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditorOpen(false);
      setEditorTask(null);
      notifyTaskBoardChanged();
    } catch (err) {
      setError(errorText(err, t('archiveTaskFailed')));
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleCreateFolder = async (name: string) => {
    const folder = await createFolder(name);
    setFolders((current) => [...current, folder].sort((a, b) => a.name.localeCompare(b.name, dateLocaleTag)));
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete || pendingTaskId !== null) return;
    const folderId = folderToDelete.id;
    setPendingTaskId(-folderId);
    setError('');
    try {
      await deleteFolder(folderId);
      setFolders((current) => current.filter((folder) => folder.id !== folderId));
      setTasks((current) => current.map((task) => (
        task.folder_id === folderId ? { ...task, folder_id: null } : task
      )));
      if (openFolderId === folderId) {
        if (folderCloseTimer.current) {
          window.clearTimeout(folderCloseTimer.current);
          folderCloseTimer.current = null;
        }
        setOpenFolderId(null);
        setFolderMotion(null);
      }
      setFolderToDelete(null);
      notifyTaskBoardChanged();
    } catch (err) {
      setError(errorText(err, t('folderDeleteFailed')));
    } finally {
      setPendingTaskId(null);
    }
  };

  const openFolderFromList = (folderId: number) => {
    if (folderId === openFolderId && folderMotion !== 'out') {
      closeOpenFolder();
      setFoldersModalOpen(false);
      return;
    }
    if (folderCloseTimer.current) {
      window.clearTimeout(folderCloseTimer.current);
      folderCloseTimer.current = null;
    }
    setOpenFolderId(folderId);
    setFolderMotion('in');
    setFoldersModalOpen(false);
  };

  const closeOpenFolder = () => {
    if (openFolderId == null || folderMotion === 'out') return;
    setFolderMotion('out');
    folderCloseTimer.current = window.setTimeout(() => {
      setOpenFolderId(null);
      setFolderMotion(null);
      folderCloseTimer.current = null;
    }, 240);
  };

  const emptyListText = tagFilter !== 'all'
    ? t('tasksTagEmpty')
    : openFolder
      ? t('folderEmpty')
      : boardTasks.some((task) => task.folder_id != null)
        ? t('unfiledEmpty')
        : t('tasksEmpty');

  return (
    <Layout>
      <div className="tasks-page">
        <div className="tasks-page-intro">
          <div
            className={`page-title-block tasks-page-title${
              mobileSummaryOpen ? ' tasks-page-title--summary-open' : ''
            }`}
          >
            <h1 className="page-title">
              {mobileLayout ? (
                <button
                  type="button"
                  className="tasks-page-title-toggle"
                  aria-expanded={mobileSummaryOpen}
                  onClick={() => setMobileSummaryOpen((open) => !open)}
                >
                  {t('tasksTitle')}
                </button>
              ) : (
                t('tasksTitle')
              )}
            </h1>
            {taskSummaryText && (
              <p className="page-subtitle">{taskSummaryText}</p>
            )}
          </div>
          <div className="tasks-controls">
            <button type="button" className="tasks-create-btn" onClick={openCreate}>
              <span>{t('createTask')}</span>
            </button>

            <button type="button" className="tasks-tag-create-btn" onClick={() => setTagManageOpen(true)}>
              <TagIcon size={18} strokeWidth={2.25} />
              <span>{t('tags')}</span>
            </button>

            <button type="button" className="tasks-archive-btn" onClick={() => setArchiveOpen(true)}>
              <Archive size={18} strokeWidth={2.25} />
              <span>{t('archive')}{archivedCount > 0 ? ` (${archivedCount})` : ''}</span>
            </button>

            <button type="button" className="tasks-folders-open-btn" onClick={() => setFoldersModalOpen(true)}>
              <FolderClosed size={18} strokeWidth={2.25} />
              <span>{t('folders')}</span>
            </button>

            <div className="tasks-sorts">
              <SortSelect<TaskSortMode>
                value={sort}
                options={[
                  { value: 'created', label: t('byDay') },
                  { value: 'priority', label: t('byPriority') },
                ]}
                onChange={setSort}
              />

              <SortSelect
                label={t('byTag')}
                value={tagFilter}
                options={[
                  { value: 'all', label: t('allTags') },
                  ...tags.map((tag) => ({ value: String(tag.id), label: formatTagName(tag.name) })),
                ]}
                onChange={setTagFilter}
              />
            </div>

            <Checkbox
              className="tasks-completed-toggle"
              checked={showCompleted}
              onChange={setShowCompleted}
              label={t('completedToggle')}
            />
          </div>
        </div>

        {error && <p className="tasks-error">{error}</p>}

        {loading && tasks.length === 0 && folders.length === 0 ? (
          <p className="tasks-placeholder">{t('tasksLoading')}</p>
        ) : (
          <div className="tasks-workspace">
            <div
              key={openFolder?.id ?? 'all'}
              className={`tasks-workspace-main${openFolder ? ' tasks-folder-stage' : ''}${folderMotion === 'out' ? ' is-closing' : ''}`}
            >
          {openFolder && (
            <div className="tasks-folder-bar">
              <span className="tasks-folder-bar-name">{openFolder.name}</span>
              <div className="tasks-folder-bar-actions">
                <button type="button" className="tasks-folder-delete" onClick={() => setFolderToDelete(openFolder)}>
                  {t('delete')}
                </button>
                <button type="button" className="tasks-folder-close" onClick={closeOpenFolder}>
                  {t('close')}
                </button>
              </div>
            </div>
          )}
          <div className="tasks-groups">
            {activeTasks.length === 0 && completedTasks.length === 0 && (
              <div className={`tasks-empty app-border-card${openFolder && tagFilter === 'all' ? ' tasks-empty-plain' : ''}`}>
                <ListTodo size={40} aria-hidden="true" />
                <p>{emptyListText}</p>
              </div>
            )}

            {activeTasks.length === 0 && completedTasks.length > 0 && !showCompleted && (
              <div className="tasks-empty tasks-empty-plain app-border-card">
                <ListTodo size={40} aria-hidden="true" />
                <p>{t('tasksActiveEmpty')}</p>
              </div>
            )}

            {activeTasks.length > 0 && (
              <section className="tasks-list" aria-label={t('activeTasks')}>
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
              <section className="tasks-list" aria-label={t('completedTasks')}>
                <h2 className="tasks-section-title">{t('completedSection')}</h2>
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
            <div className="tasks-workspace-side">
              <aside ref={foldersPanelRef} className="task-folders-panel">
                <TaskFolders
                  folders={folders}
                  activeFolderId={openFolder?.id ?? null}
                  onOpen={openFolderFromList}
                  onCreate={handleCreateFolder}
                />
              </aside>
              <TaskActivityCalendar tasks={boardTasks} />
            </div>
          </div>
        )}
      </div>

      {taskToDelete && (
        <Modal
          title={t('deleteTaskTitle')}
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
            <p>{t('deleteTaskConfirm', { title: taskToDelete.title })}</p>
            <ModalActions
              onCancel={() => {
                if (pendingTaskId === taskToDelete.id) return;
                setTaskToDelete(null);
              }}
              submitLabel={t('delete')}
              pending={pendingTaskId === taskToDelete.id}
              pendingLabel={t('deleting')}
            />
          </form>
        </Modal>
      )}

      {editorOpen && (
        <TaskEditorModal
          key={editorTask?.id ?? 'create'}
          task={editorTask}
          tags={tags}
          folders={folders}
          folderId={editorTask ? undefined : openFolder?.id}
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

      {foldersModalOpen && (
        <Modal
          title={t('folders')}
          isOpen
          onClose={() => setFoldersModalOpen(false)}
          className="task-folders-modal glass-modal"
        >
          <TaskFolders
            folders={folders}
            activeFolderId={openFolder?.id ?? null}
            onOpen={openFolderFromList}
            onCreate={handleCreateFolder}
          />
          <button type="button" className="modal-action-cancel task-folders-close" onClick={() => setFoldersModalOpen(false)}>
            {t('close')}
          </button>
        </Modal>
      )}

      {folderToDelete && (
        <Modal
          title={t('deleteFolder')}
          isOpen
          onClose={() => {
            if (pendingTaskId !== null) return;
            setFolderToDelete(null);
          }}
        >
          <form
            className="task-delete-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleDeleteFolder();
            }}
          >
            <p>{t('deleteFolderConfirm', { name: folderToDelete.name })}</p>
            <ModalActions
              onCancel={() => {
                if (pendingTaskId !== null) return;
                setFolderToDelete(null);
              }}
              submitLabel={t('delete')}
              pending={pendingTaskId !== null}
              pendingLabel={t('deleting')}
            />
          </form>
        </Modal>
      )}

      {archiveOpen && (
        <TaskArchiveModal
          tasks={tasks}
          onClose={() => setArchiveOpen(false)}
          onTaskUpdated={(task) => {
            setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
            notifyTaskBoardChanged();
          }}
          onTaskDeleted={(taskId) => {
            setTasks((current) => current.filter((item) => item.id !== taskId));
            notifyTaskBoardChanged();
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
          ariaLabel={task.completed ? t('restoreTask', { title: task.title }) : t('completeTask', { title: task.title })}
          onChange={handleCheck}
        />

        <div className="task-card-body">
          <div className="task-card-title-slot">
            <button type="button" className="task-card-title" title={task.title} onClick={() => onEdit(task)}>
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
                : <span>{t('emptyDue')}</span>
            )}
            {task.completed && task.completed_at && (
              <time className="task-card-completed-at" dateTime={task.completed_at}>
                {formatCompletedAt(task.completed_at)}
              </time>
            )}
          </p>
        </div>

        <div className="task-card-side">
          <button
            type="button"
            className="task-icon-btn task-card-edit"
            aria-label={t('editTaskAria', { title: task.title })}
            onClick={() => onEdit(task)}
          >
            <Pencil size={20} />
          </button>
          {task.tags[0] && (
            <span
              className="task-card-tag"
              style={{ '--tag-color': task.tags[0].color } as CSSProperties}
            >
              <span className="task-card-tag-shadow" aria-hidden="true" />
              <span className="task-card-tag-face">{formatTagName(task.tags[0].name)}</span>
            </span>
          )}
        </div>
      </article>
    </Vaporize>
  );
}
