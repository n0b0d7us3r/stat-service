import { useEffect, useState } from 'react';
import { Pencil, PencilOff } from 'lucide-react';
import { getNote, saveNote } from '../api/notes';
import type { Achievement } from '../types';
import { parseLocalDate } from '../utils/date';
import { dateLocaleTag, t } from '../i18n';
import '../styles/components/ProjectDayNotes.css';

interface ProjectDayNotesProps {
  projectId: number;
  selectedDate: string | null;
  onNoteSaved?: (newlyEarned: Achievement[]) => void;
}

function formatSelectedDate(dateKey: string): string {
  return parseLocalDate(dateKey).toLocaleDateString(dateLocaleTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ProjectDayNotes({ projectId, selectedDate, onNoteSaved }: ProjectDayNotesProps) {
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedDate) {
      setContent('');
      setDraft('');
      setEditMode(false);
      return;
    }

    void getNote(projectId, selectedDate).then((note) => {
      const noteContent = note?.content ?? '';
      setContent(noteContent);
      setDraft(noteContent);
      setEditMode(false);
    });
  }, [projectId, selectedDate]);

  const handleSave = async () => {
    if (!selectedDate) return;

    setSaving(true);
    try {
      const { note, newlyEarned } = await saveNote(projectId, selectedDate, draft);
      setContent(note.content);
      setEditMode(false);
      onNoteSaved?.(newlyEarned);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(content);
    setEditMode(false);
  };

  return (
    <section className={`project-day-notes app-border-card${selectedDate ? ' project-day-notes-has-date' : ''}`}>
      <div className="project-day-notes-header">
        <h2 className="project-day-notes-title">{t('notes')}</h2>
      </div>

      {!selectedDate ? (
        <p className="project-day-notes-empty">{t('notesPickDay')}</p>
      ) : (
        <>
          <button
            type="button"
            className={`project-day-notes-edit-btn ${editMode ? 'active' : ''}`}
            onClick={() => setEditMode((value) => !value)}
          >
            {editMode ? <PencilOff size={16} /> : <Pencil size={16} />}
            <span>{editMode ? t('view') : t('edit')}</span>
          </button>

          <p className="project-day-notes-date">{formatSelectedDate(selectedDate)}</p>

          {editMode ? (
            <div className="project-day-notes-editor">
              <textarea
                className="project-day-notes-textarea"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('notePlaceholder')}
                rows={8}
                autoFocus
              />
              <div className="project-day-notes-editor-actions">
                <button type="button" className="project-day-notes-cancel-btn" onClick={handleCancel}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="project-day-notes-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="project-day-notes-content">
              {content.trim() ? content : <span className="project-day-notes-placeholder">{t('notesDayEmpty')}</span>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
