import { ApiDataError, type Project, type ProjectType } from '../types';
import { apiFetch } from './client';

export async function getProjectsByUser(_userId: number): Promise<Project[]> {
  const { projects } = await apiFetch<{ projects: Project[] }>('/projects');
  return projects;
}

export async function getProjectById(_userId: number, projectId: number): Promise<Project | null> {
  try {
    const { project } = await apiFetch<{ project: Project }>(`/projects/${projectId}`);
    return project;
  } catch {
    return null;
  }
}

export async function createProject(
  _userId: number,
  name: string,
  description = '',
  projectType: ProjectType = 'calendar',
  isMutable = false,
): Promise<Project> {
  try {
    const { project } = await apiFetch<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description, projectType, isMutable }),
    });
    return project;
  } catch (error) {
    if (error instanceof Error) {
      throw new ApiDataError(error.message);
    }
    throw error;
  }
}

export async function deleteProject(_userId: number, projectId: number): Promise<void> {
  await apiFetch(`/projects/${projectId}`, { method: 'DELETE' });
}
