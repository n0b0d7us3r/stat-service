import { useState } from 'react';
import { CalendarDays, Target } from 'lucide-react';
import { Modal } from './Modal';
import { ModalActions } from './ModalActions';
import { Checkbox } from './Checkbox';
import { createProject } from '../api/projects';
import { t } from '../i18n';
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
      setError(err instanceof ApiDataError ? err.message : t('createProjectFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal title={t('newProject')} isOpen={isOpen} onClose={handleClose}>
      <form className="create-project-form" onSubmit={handleSubmit}>
        {error && <p className="create-project-error">{error}</p>}

        <label className="create-project-field">
          <span>{t('name')}</span>
          <input
            type="text"
            className="create-project-input"
            placeholder={t('projectNamePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="create-project-field">
          <span>{t('description')}</span>
          <textarea
            className="create-project-textarea"
            placeholder={t('projectDescriptionPlaceholder')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>

        <fieldset className="create-project-type-fieldset">
          <legend>{t('projectType')}</legend>
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
              <span>{t('typeCalendar')}</span>
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
              <span>{t('typeGoals')}</span>
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
            label={t('mutableLabel')}
          />
          <p className="create-project-mutable-hint">
            {projectType === 'goals' ? t('mutableHintGoals') : t('mutableHintMarks')}
          </p>
        </div>

        <ModalActions
          onCancel={handleClose}
          submitLabel={t('create')}
          pending={creating}
          pendingLabel={t('creating')}
        />
      </form>
    </Modal>
  );
}
