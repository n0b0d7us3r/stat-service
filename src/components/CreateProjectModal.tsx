import { useState } from 'react';
import { CalendarDays, Target } from 'lucide-react';
import { Modal } from './Modal';
import { Checkbox } from './Checkbox';
import { createProject } from '../api/projects';
import { ApiDataError, type ProjectType } from '../types';
import type { Project } from '../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  userId: number;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function CreateProjectModal({ isOpen, userId, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('calendar');
  const [isMutable, setIsMutable] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setProjectType('calendar');
    setIsMutable(true);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setCreating(true);

    try {
      const project = await createProject(userId, name, description, projectType, isMutable);
      resetForm();
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiDataError ? err.message : 'Не удалось создать проект');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal title="Новый проект" isOpen={isOpen} onClose={handleClose}>
      <form className="create-project-form" onSubmit={handleSubmit}>
        {error && <p className="create-project-error">{error}</p>}

        <label className="create-project-field">
          <span>Название</span>
          <input
            type="text"
            className="create-project-input"
            placeholder="Название проекта"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="create-project-field">
          <span>Описание</span>
          <textarea
            className="create-project-textarea"
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>

        <fieldset className="create-project-type-fieldset">
          <legend>Тип проекта</legend>
          <div className="create-project-type-options">
            <label className={`create-project-type-option ${projectType === 'calendar' ? 'active' : ''}`}>
              <input
                type="radio"
                name="projectType"
                value="calendar"
                checked={projectType === 'calendar'}
                onChange={() => setProjectType('calendar')}
              />
              <CalendarDays size={18} />
              <span>Календарь</span>
            </label>

            <label className={`create-project-type-option ${projectType === 'goals' ? 'active' : ''}`}>
              <input
                type="radio"
                name="projectType"
                value="goals"
                checked={projectType === 'goals'}
                onChange={() => setProjectType('goals')}
              />
              <Target size={18} />
              <span>Цели</span>
            </label>

            {/* Временно скрыто: тип «День»
            <label className="create-project-type-option disabled" title="Скоро будет доступно">
              <input
                type="radio"
                name="projectType"
                value="day"
                disabled
              />
              <Sun size={18} />
              <span>День</span>
              <em>Скоро</em>
            </label>
            */}
          </div>
        </fieldset>

        <div className="create-project-mutable-field">
          <Checkbox
            checked={isMutable}
            onChange={setIsMutable}
            label="Изменяемый"
          />
          <p className="create-project-mutable-hint">
            Если выключено, отметки{projectType === 'goals' ? ' и цели' : ''} можно только ставить — удалить их нельзя.
          </p>
        </div>

        <div className="create-project-actions">
          <button type="button" className="create-project-cancel-btn" onClick={handleClose}>
            Отмена
          </button>
          <button type="submit" className="create-project-submit-btn" disabled={creating}>
            {creating ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
