import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Pencil, PencilOff, Trash2, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { ProjectCalendar, type ProjectCalendarHandle } from '../components/ProjectCalendar';
import { ProjectDayNotes } from '../components/ProjectDayNotes';
import { ProjectStats } from '../components/ProjectStats';
import { useAuth } from '../context/AuthContext';
import { verifyUserPassword } from '../api/auth';
import { getProjectStats } from '../api/marks';
import { deleteProject, getProjectById } from '../api/projects';
import type { Project, ProjectStats as ProjectStatsData } from '../types';
import { useAchievementCelebration } from '../context/AchievementCelebrationContext';
import '../styles/ProjectPage.css';

export function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { celebrateAchievements } = useAchievementCelebration();
  const projectId = Number(id);
  const calendarRef = useRef<ProjectCalendarHandle>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(() => {
    if (!user || !Number.isFinite(projectId)) {
      setProject(null);
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void getProjectById(user.id, projectId)
      .then(async (loadedProject) => {
        setProject(loadedProject);
        if (loadedProject) {
          setStats(await getProjectStats(projectId));
        } else {
          setStats(null);
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (project) {
      document.title = `${project.name} | Game Stat`;
    }
  }, [project]);

  const handleStatsRefresh = () => {
    if (!project || !user) return;
    void Promise.all([
      getProjectStats(project.id),
      getProjectById(user.id, project.id),
    ]).then(([nextStats, nextProject]) => {
      setStats(nextStats);
      if (nextProject) {
        setProject(nextProject);
      }
    });
  };

  const handleNotesRefresh = () => {
    setNotesRefreshKey((value) => value + 1);
    void celebrateAchievements();
  };

  const startEditMode = () => setEditMode(true);

  const applyEditMode = () => {
    void calendarRef.current?.applyMarks().then(() => {
      setEditMode(false);
      handleStatsRefresh();

      if (user) {
        void celebrateAchievements();
      }
    });
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setNotesRefreshKey((value) => value + 1);
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !project) return;

    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Введите пароль для подтверждения');
      return;
    }

    setDeleting(true);

    try {
      const isValid = await verifyUserPassword(user.id, deletePassword);
      if (!isValid) {
        setDeleteError('Неверный пароль');
        return;
      }

      await deleteProject(user.id, project.id);
      navigate('/projects');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="project-page">
          <p className="project-page-loading">Загрузка проекта...</p>
        </div>
      </Layout>
    );
  }

  if (!project || !stats || !user) {
    return (
      <Layout>
        <div className="project-page">
          <button type="button" className="project-toolbar-btn project-toolbar-back" onClick={() => navigate('/projects')}>
            <ChevronLeft size={18} />
            <span className="project-toolbar-label">К проектам</span>
          </button>
          <div className="project-page-empty">
            <p>Проект не найден.</p>
            <Link to="/projects">Вернуться к списку проектов</Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="project-page">
        <div className="project-page-header">
          <button type="button" className="project-toolbar-btn project-toolbar-back" onClick={() => navigate('/projects')}>
            <ChevronLeft size={18} />
            <span className="project-toolbar-label">К проектам</span>
          </button>
        </div>

        <PageTitle title={project.name} subtitle={project.description || 'Календарь и статистика проекта'} />

        <section className={`project-stats-section ${statsExpanded ? 'expanded' : 'collapsed'}`}>
          <button
            type="button"
            className="project-stats-toggle"
            onClick={() => setStatsExpanded((value) => !value)}
            aria-expanded={statsExpanded}
          >
            <span>Статистика</span>
            <ChevronDown size={18} className="project-stats-toggle-icon" />
          </button>
          <div className="project-stats-panel">
            <ProjectStats stats={stats} />
          </div>
        </section>

        <div className="project-workspace">
          <div className="project-calendar-column">
            <div className="project-calendar-toolbar">
              {editMode ? (
                <div className="project-calendar-toolbar-actions">
                  <button
                    type="button"
                    className="project-toolbar-btn project-toolbar-cancel"
                    onClick={cancelEditMode}
                  >
                    <X size={18} />
                    <span className="project-toolbar-label">Отменить</span>
                  </button>
                  <button
                    type="button"
                    className="project-toolbar-btn project-toolbar-edit active"
                    onClick={applyEditMode}
                  >
                    <PencilOff size={18} />
                    <span className="project-toolbar-label">Готово</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="project-toolbar-btn project-toolbar-edit"
                  onClick={startEditMode}
                >
                  <Pencil size={18} />
                  <span className="project-toolbar-label">Добавить отметки</span>
                </button>
              )}
            </div>
            <ProjectCalendar
              ref={calendarRef}
              key={notesRefreshKey}
              projectId={project.id}
              editMode={editMode}
              isAdmin={user.is_admin}
              isMutable={project.is_mutable}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onChange={handleStatsRefresh}
            />
          </div>
          <ProjectDayNotes
            projectId={project.id}
            selectedDate={selectedDate}
            onNoteSaved={handleNotesRefresh}
          />
        </div>

        <section className={`project-settings-section ${settingsExpanded ? 'expanded' : 'collapsed'}`}>
          <button
            type="button"
            className="project-settings-toggle"
            onClick={() => setSettingsExpanded((value) => !value)}
            aria-expanded={settingsExpanded}
          >
            <span>Настройки</span>
            <ChevronDown size={18} className="project-settings-toggle-icon" />
          </button>

          <div className="project-settings-panel app-border-card">
            <p className="project-settings-description">
              Удаление проекта «{project.name}» необратимо. Все отметки и заметки будут потеряны.
            </p>

            <form className="project-delete-form" onSubmit={handleDelete}>
              <label className="project-delete-field">
                <span>Пароль для подтверждения</span>
                <input
                  type="password"
                  className="project-delete-input"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Введите ваш пароль"
                  autoComplete="current-password"
                />
              </label>

              {deleteError && <p className="project-delete-error">{deleteError}</p>}

              <button type="submit" className="project-delete-submit-btn" disabled={deleting}>
                <Trash2 size={18} />
                <span>{deleting ? 'Удаление...' : 'Удалить проект'}</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </Layout>
  );
}
