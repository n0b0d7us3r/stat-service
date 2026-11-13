import { useCallback, useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { FilterSection } from '../components/FilterSection';
import { PageTitle } from '../components/PageTitle';
import { Pagination } from '../components/Pagination';
import { APP_NAME } from '../config/app';
import { getNotes, NOTES_PAGE_SIZE } from '../api/notes';
import type { DayNoteListItem, NotesListResult, NotesSortMode } from '../types';
import { parseLocalDate } from '../utils/date';
import { useMobileHeaderSubtitle } from '../context/MobileHeaderTitleContext';
import { dateLocaleTag, t } from '../i18n';
import '../styles/NotesPage.css';
import '../styles/components/DashboardMonthTable.css';

function formatNoteDate(dateKey: string): string {
  const label = parseLocalDate(dateKey).toLocaleDateString(dateLocaleTag, {
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
    document.title = `${t('notesTitle')} | ${APP_NAME}`;
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

  useMobileHeaderSubtitle(loading ? t('loading') : t('notesTotal', { count: total }));

  return (
    <Layout>
      <div className="notes-page">
        <div className="notes-page-header">
          <PageTitle
            title={t('notesTitle')}
            subtitle={loading ? t('loading') : t('notesTotal', { count: total })}
          />

          <FilterSection className="notes-filter-section">
            <div className="dashboard-month-toolbar notes-filter-toolbar">
              <div className="dashboard-month-filters">
                <label className="dashboard-month-filter">
                  <select
                    className="dashboard-month-filter-select"
                    value={sort}
                    aria-label={t('sort')}
                    onChange={(event) => handleSortChange(event.target.value as NotesSortMode)}
                  >
                    <option value="date">{t('byDay')}</option>
                    <option value="project">{t('byProject')}</option>
                  </select>
                </label>
              </div>
            </div>
          </FilterSection>
        </div>

        {loading && notes.length === 0 ? (
          <p className="notes-placeholder">{t('notesLoading')}</p>
        ) : notes.length === 0 ? (
          <div className="notes-empty app-border-card">
            <StickyNote size={40} aria-hidden="true" />
            <p>{t('notesEmpty')}</p>
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
                      className="note-card app-border-card"
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
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={t('notesPages')}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
