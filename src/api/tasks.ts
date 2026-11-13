import type { Achievement, Folder, Tag, Task, TaskPriority } from '../types';
import { API_BASE, ApiError, apiFetch, parseError } from './client';

export interface TaskBoard {
  tasks: Task[];
  tags: Tag[];
  folders: Folder[];
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

export async function createFolder(name: string): Promise<Folder> {
  const { folder } = await apiFetch<{ folder: Folder }>('/folders', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return folder;
}

export async function deleteFolder(folderId: number): Promise<void> {
  await apiFetch(`/folders/${folderId}`, { method: 'DELETE' });
}

export async function createTask(input: {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  tagIds: number[];
  folderId?: number | null;
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
    dueDate?: string | null;
    completed?: boolean;
    archived?: boolean;
    tagIds?: number[];
    folderId?: number | null;
  },
): Promise<{ task: Task; newlyEarned: Achievement[] }> {
  const { task, newlyEarned = [] } = await apiFetch<{ task: Task; newlyEarned?: Achievement[] }>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return { task, newlyEarned };
}

export async function deleteTask(taskId: number): Promise<void> {
  await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
}

export async function uploadTaskDescriptionImage(file: File): Promise<{ url: string; filename: string }> {
  const contentType = file.type?.startsWith('image/') ? file.type : 'image/png';
  const response = await fetch(`${API_BASE}/tasks/description-images`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<{ url: string; filename: string }>;
}
