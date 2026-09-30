import type { Tag, Task, TaskPriority } from '../types';
import { apiFetch } from './client';

export interface TaskBoard {
  tasks: Task[];
  tags: Tag[];
}

export async function getTaskBoard(): Promise<TaskBoard> {
  return apiFetch<TaskBoard>('/tasks');
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const { tag } = await apiFetch<{ tag: Tag }>('/tags', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
  return tag;
}

export async function deleteTag(tagId: number): Promise<void> {
  await apiFetch(`/tags/${tagId}`, { method: 'DELETE' });
}

export async function createTask(input: {
  title: string;
  description: string;
  priority: TaskPriority;
  tagIds: number[];
}): Promise<Task> {
  const { task } = await apiFetch<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return task;
}

export async function updateTask(
  taskId: number,
  input: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    completed?: boolean;
    tagIds?: number[];
  },
): Promise<Task> {
  const { task } = await apiFetch<{ task: Task }>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return task;
}

export async function deleteTask(taskId: number): Promise<void> {
  await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
}
