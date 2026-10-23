import { useState } from 'react';
import { Archive } from 'lucide-react';
import { Modal } from './Modal';
import { ApiError } from '../api/client';
import { deleteTask, updateTask } from '../api/tasks';
import type { Task } from '../types';
import { TaskDescriptionContent } from './TaskDescriptionContent';
import { compareTasks, formatTagName } from '../utils/taskUi';
import '../styles/components/TaskArchiveModal.css';

interface TaskArchiveModalProps {
  tasks: Task[];
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: number) => void;
}

export function TaskArchiveModal({
  tasks,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskArchiveModalProps) {
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const archivedTasks = tasks
    .filter((task) => task.archived)
    .sort((a, b) => compareTasks(a, b, 'priority'));

  const handleRestore = async (task: Task) => {
    if (pendingTaskId === task.id) return;
    setPendingTaskId(task.id);
    setError('');

    try {
      const updated = await updateTask(task.id, { archived: false });
      onTaskUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось вернуть задачу');
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleDelete = async (task: Task) => {
    if (pendingTaskId === task.id) return;
    setPendingTaskId(task.id);
    setError('');

    try {
      await deleteTask(task.id);
      onTaskDeleted(task.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить задачу');
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <Modal title="Архив задач" isOpen onClose={onClose}>
      <div className="task-archive-modal">
        {error && <p className="task-editor-error">{error}</p>}

        {archivedTasks.length === 0 ? (
          <div className="task-archive-empty">
            <Archive size={32} aria-hidden="true" />
            <p>В архиве пока нет задач.</p>
          </div>
        ) : (
          <ul className="task-archive-list">
            {archivedTasks.map((task) => (
              <li key={task.id} className="task-archive-item app-border-card">
                <div className="task-archive-item-body">
                  <p className="task-archive-item-title">
                    {task.tags[0] && (
                      <span className="task-archive-item-tag" style={{ color: task.tags[0].color }}>
                        [ {formatTagName(task.tags[0].name)} ]{' '}
                      </span>
                    )}
                    {task.title}
                  </p>
                  {task.description.trim() && (
                    <div className="task-archive-item-description">
                      <TaskDescriptionContent value={task.description} />
                    </div>
                  )}
                </div>
                <div className="task-archive-item-actions">
                  <button
                    type="button"
                    className="task-archive-restore-btn"
                    disabled={pendingTaskId === task.id}
                    onClick={() => void handleRestore(task)}
                  >
                    Вернуть
                  </button>
                  <button
                    type="button"
                    className="task-archive-delete-btn"
                    disabled={pendingTaskId === task.id}
                    onClick={() => void handleDelete(task)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="task-archive-close-btn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Modal>
  );
}
