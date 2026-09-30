import { ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../types';
import { compareTasks, formatTagName } from '../utils/taskUi';
import '../styles/components/DashboardTaskList.css';

interface DashboardTaskListProps {
  tasks: Task[];
  emptyText: string;
}

export function DashboardTaskList({ tasks, emptyText }: DashboardTaskListProps) {
  const navigate = useNavigate();
  const ordered = [...tasks].sort((a, b) => compareTasks(a, b, 'priority'));

  if (ordered.length === 0) {
    return (
      <div className="dashboard-task-list-empty app-border-card">
        <ListTodo size={28} aria-hidden="true" />
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <ul className="dashboard-task-list">
      {ordered.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            className={`dashboard-task-list-item app-border-card ${task.completed ? 'dashboard-task-list-item-done' : ''}`}
            onClick={() => navigate('/tasks')}
          >
            <span className="dashboard-task-list-title">
              {task.tags[0] && (
                <span className="dashboard-task-list-tag" style={{ color: task.tags[0].color }}>
                  [ {formatTagName(task.tags[0].name)} ]
                </span>
              )}
              <span>{task.title}</span>
            </span>
            <span className="dashboard-task-list-status">
              {task.completed ? 'Выполнена' : 'Ожидает'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
