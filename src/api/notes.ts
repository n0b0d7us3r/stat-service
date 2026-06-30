import type { Achievement, DayNote, NotesListResult, NotesSortMode } from '../types';
import { apiFetch } from './client';

export const NOTES_PAGE_SIZE = 25;

export async function getNotes(options: {
  sort?: NotesSortMode;
  page?: number;
  limit?: number;
} = {}): Promise<NotesListResult> {
  const params = new URLSearchParams();
  params.set('sort', options.sort ?? 'date');
  params.set('page', String(options.page ?? 1));
  params.set('limit', String(options.limit ?? NOTES_PAGE_SIZE));

  const { result } = await apiFetch<{ result: NotesListResult }>(`/notes?${params.toString()}`);
  return result;
}

export async function getNote(projectId: number, date: string): Promise<DayNote | null> {
  const { note } = await apiFetch<{ note: DayNote | null }>(`/projects/${projectId}/notes/${date}`);
  return note;
}

export async function getNoteDatesForMonth(
  projectId: number,
  year: number,
  month: number,
): Promise<string[]> {
  const { dates } = await apiFetch<{ dates: string[] }>(
    `/projects/${projectId}/notes?year=${year}&month=${month}`,
  );
  return dates;
}

export async function saveNote(
  projectId: number,
  date: string,
  content: string,
): Promise<{ note: DayNote; newlyEarned: Achievement[] }> {
  const { note, newlyEarned } = await apiFetch<{ note: DayNote; newlyEarned: Achievement[] }>(
    `/projects/${projectId}/notes/${date}`,
    {
      method: 'PUT',
      body: JSON.stringify({ content }),
    },
  );
  return { note, newlyEarned };
}
