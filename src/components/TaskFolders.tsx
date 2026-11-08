import { useId, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
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
  onDelete: (folder: Folder) => void;
}

export function FolderGlyph({ id }: { id: string }) {
  const fill = `${id}-fill`;
  const lip = `${id}-lip`;

  return (
    <svg className="task-folder-glyph" viewBox="0 0 80 64" aria-hidden="true">
      <defs>
        <linearGradient id={fill} x1="8" y1="20" x2="74" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8eb4dc" />
          <stop offset="46%" stopColor="#2a5880" />
          <stop offset="100%" stopColor="#142838" />
        </linearGradient>
        <linearGradient id={lip} x1="6" y1="22" x2="74" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d7e7f6" />
          <stop offset="100%" stopColor="#8eb4dc" />
        </linearGradient>
      </defs>
      <path d="M10 24 H76 V60 H10 Z" fill="#0b1520" transform="translate(3 3)" />
      <path d="M8 24 V16 H30 L36 10 H70 V24 Z" fill="#1a3048" />
      <path d="M6 22 H74 V56 H6 Z" fill={`url(#${fill})`} />
      <path d="M6 22 H74 V29 H6 Z" fill={`url(#${lip})`} opacity="0.42" />
    </svg>
  );
}

export function TaskFolders({
  folders,
  activeFolderId,
  pending = false,
  onOpen,
  onCreate,
  onDelete,
}: TaskFoldersProps) {
  const baseId = useId().replace(/:/g, '');
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
            <FolderGlyph id={`${baseId}-${folder.id}`} />
            <span className="task-folder-name">{folder.name}</span>
          </button>
          <button
            type="button"
            className="task-folder-delete"
            aria-label={t('deleteFolder')}
            onClick={() => onDelete(folder)}
          >
            <X size={14} strokeWidth={2.25} />
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
