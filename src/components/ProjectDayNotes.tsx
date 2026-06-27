import { useEffect, useState } from 'react';
import { Pencil, PencilOff } from 'lucide-react';
import { getNote, saveNote } from '../api/notes';
import { parseLocalDate } from '../utils/date';
import '../styles/components/ProjectDayNotes.css';

interface ProjectDayNotesProps {
  projectId: number;
  selectedDate: string | null;
  onNoteSaved?: () => void;
}

function formatSelectedDate(dateKey: string): string {
  return parseLocalDate(dateKey).toLocaleDateString('ru-RU', {
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
      const saved = await saveNote(projectId, selectedDate, draft);
      setContent(saved.content);
      setEditMode(false);
      onNoteSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(content);
    setEditMode(false);
  };

  return (
    <section className="project-day-notes app-border-card">
      <div className="project-day-notes-header">
        <h2 className="project-day-notes-title">Заметки</h2>
        {selectedDate && (
          <button
            type="button"
            className={`project-day-notes-edit-btn ${editMode ? 'active' : ''}`}
            onClick={() => setEditMode((value) => !value)}
          >
            {editMode ? <PencilOff size={16} /> : <Pencil size={16} />}
            <span>{editMode ? 'Просмотр' : 'Редактировать'}</span>
          </button>
        )}
      </div>

      {!selectedDate ? (
        <p className="project-day-notes-empty">Выберите день в календаре, чтобы посмотреть или добавить заметку.</p>
      ) : (
        <>
          <p className="project-day-notes-date">{formatSelectedDate(selectedDate)}</p>

          {editMode ? (
            <div className="project-day-notes-editor">
              <textarea
                className="project-day-notes-textarea"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Запишите заметку по этому дню..."
                rows={8}
                autoFocus
              />
              <div className="project-day-notes-editor-actions">
                <button type="button" className="project-day-notes-cancel-btn" onClick={handleCancel}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="project-day-notes-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          ) : (
            <div className="project-day-notes-content">
              {content.trim() ? content : <span className="project-day-notes-placeholder">Заметок пока нет.</span>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
