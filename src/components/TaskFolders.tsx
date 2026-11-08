import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { ApiError } from '../api/client';
import type { Folder } from '../types';
import { t } from '../i18n';
import '../styles/components/TaskFolders.css';

interface TaskFoldersProps {
  folders: Folder[];
  activeFolderId: number | null;
  pending?: boolean;
  onOpen: (folderId: number) => void;
  onCreate: (name: string) => Promise<void>;
}

export function FolderGlyph() {
  return (
    <svg className="task-folder-glyph" viewBox="0 0 86 60" aria-hidden="true">
      <polygon className="task-folder-glyph-tab" points="3,0 31,0 36,5 82,5 82,12 3,12" />
      <polygon className="task-folder-glyph-body" points="0,12 86,12 86,59 0,59" />
    </svg>
  );
}

export function TaskFolders({
  folders,
  activeFolderId,
  pending = false,
  onOpen,
  onCreate,
}: TaskFoldersProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const closeCreate = () => {
    setCreating(false);
    setName('');
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('folderNameRequired'));
      return;
    }

    setError('');
    try {
      await onCreate(trimmed);
      setName('');
      setCreating(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('folderCreateFailed'));
    }
  };

  return (
    <div className="task-folders-grid">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className={`task-folder-tile${activeFolderId === folder.id ? ' is-active' : ''}`}
        >
          <button type="button" className="task-folder-open" onClick={() => onOpen(folder.id)}>
            <FolderGlyph />
            <span className="task-folder-name">{folder.name}</span>
          </button>
        </div>
      ))}

      {creating ? (
        <form className="task-folder-create" onSubmit={(event) => void submit(event)}>
          <input
            value={name}
            maxLength={40}
            autoFocus
            placeholder={t('folderNamePlaceholder')}
            aria-label={t('folderNamePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
          {error && <p className="task-folder-error">{error}</p>}
          <div className="task-folder-create-actions">
            <button type="button" className="modal-action-cancel" onClick={closeCreate}>
              {t('close')}
            </button>
            <button type="submit" className="task-folder-submit" disabled={pending}>
              {t('createFolder')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="task-folder-tile task-folder-add" onClick={() => setCreating(true)}>
          <Plus size={22} strokeWidth={2.25} />
          <span className="task-folder-name">{t('newFolder')}</span>
        </button>
      )}
    </div>
  );
}
