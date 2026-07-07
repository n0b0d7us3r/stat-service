import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { APP_NAME } from '../config/app';
import { getNotes, NOTES_PAGE_SIZE } from '../api/notes';
import type { DayNoteListItem, NotesListResult, NotesSortMode } from '../types';
import { parseLocalDate } from '../utils/date';
import '../styles/NotesPage.css';

function formatNoteDate(dateKey: string): string {
  const label = parseLocalDate(dateKey).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function NotesPage() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<NotesSortMode>('date');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<NotesListResult | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    void getNotes({ sort, page, limit: NOTES_PAGE_SIZE })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [sort, page]);

  useEffect(() => {
    document.title = `Заметки | ${APP_NAME}`;
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSortChange = (nextSort: NotesSortMode) => {
    if (nextSort === sort) return;
    setSort(nextSort);
    setPage(1);
  };

  const handleOpenNote = (note: DayNoteListItem) => {
    navigate(`/projects/${note.project_id}`, { state: { selectedDate: note.date } });
  };

  const notes = result?.notes ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 0;
  const showPagination = totalPages > 1;

  return (
    <Layout>
      <div className="notes-page">
        <div className="notes-page-header">
          <PageTitle
            title="Заметки"
            subtitle={loading ? 'Загрузка...' : `Всего ${total}`}
          />

          <div className="notes-sort-toggle" role="group" aria-label="Сортировка заметок">
            <button
              type="button"
              className={`notes-sort-btn ${sort === 'date' ? 'notes-sort-btn-active' : ''}`}
              onClick={() => handleSortChange('date')}
            >
              По дням
            </button>
            <button
              type="button"
              className={`notes-sort-btn ${sort === 'project' ? 'notes-sort-btn-active' : ''}`}
              onClick={() => handleSortChange('project')}
            >
              По проектам
            </button>
          </div>
        </div>

        {loading && notes.length === 0 ? (
          <p className="notes-placeholder">Загрузка заметок...</p>
        ) : notes.length === 0 ? (
          <div className="notes-empty app-border-card">
            <StickyNote size={40} aria-hidden="true" />
            <p>Заметок пока нет. Добавьте их на странице проекта, выбрав день в календаре.</p>
          </div>
        ) : (
          <>
            <div className="notes-list">
              {notes.map((note, index) => {
                const showProjectHeader = sort === 'project'
                  && (index === 0 || notes[index - 1].project_id !== note.project_id);

                return (
                  <div key={note.id} className="notes-list-item">
                    {showProjectHeader && (
                      <h2 className="notes-project-heading">{note.project_name}</h2>
                    )}

                    <button
                      type="button"
                      className="note-card app-border-card app-border-card-accent"
                      onClick={() => handleOpenNote(note)}
                    >
                      <div className="note-card-header">
                        {sort === 'date' && (
                          <span className="note-card-project">{note.project_name}</span>
                        )}
                        <time className="note-card-date" dateTime={note.date}>
                          {formatNoteDate(note.date)}
                        </time>
                      </div>

                      <div className="note-card-content-wrap">
                        <p className="note-card-content">{note.content}</p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {showPagination && (
              <nav className="notes-pagination" aria-label="Страницы заметок">
                <button
                  type="button"
                  className="notes-pagination-btn"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft size={18} />
                  <span>Назад</span>
                </button>

                <span className="notes-pagination-info">
                  Страница {page} из {totalPages}
                </span>

                <button
                  type="button"
                  className="notes-pagination-btn"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                  aria-label="Следующая страница"
                >
                  <span>Вперёд</span>
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
