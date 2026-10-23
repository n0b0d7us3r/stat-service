import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderKanban } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { APP_NAME } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { useAchievementCelebration } from '../context/AchievementCelebrationContext';
import { getProjectsByUser } from '../api/projects';
import type { Project } from '../types';
import { projectTypeLabel, t } from '../i18n';
import '../styles/ProjectsPage.css';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { celebrateAchievements } = useAchievementCelebration();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const reloadProjects = useCallback(() => {
    if (!user) return;
    void getProjectsByUser(user.id).then(setProjects);
  }, [user]);

  useEffect(() => {
    document.title = `${t('projectsTitle')} | ${APP_NAME}`;
    reloadProjects();
  }, [reloadProjects]);

  const handleCreated = (project: Project) => {
    setIsModalOpen(false);
    reloadProjects();
    void celebrateAchievements();
    navigate(`/projects/${project.id}`);
  };

  return (
    <Layout>
      <div className="projects-page">
        <div className="projects-page-intro">
          <PageTitle title={t('projectsTitle')} subtitle={t('projectsSubtitle')} />
          <button type="button" className="projects-create-open-btn" onClick={() => setIsModalOpen(true)}>
            <span>{t('createProject')}</span>
          </button>
        </div>

        <section className="projects-list-section">
          <h2 className="projects-section-title">
            {t('projectsCount', { count: projects.length })}
          </h2>

          {projects.length === 0 ? (
            <div className="projects-empty app-border-card">
              <FolderKanban size={32} />
              <p>{t('projectsEmpty')}</p>
            </div>
          ) : (
            <div className="projects-list">
              {projects.map((project) => (
                <article key={project.id} className="project-card app-border-card">
                  <button
                    type="button"
                    className="project-card-main"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="project-card-content">
                      <h3>{project.name}</h3>
                      <div className="project-card-meta-row">
                        <span className="project-card-type">{projectTypeLabel(project.project_type)}</span>
                        <span
                          className={`project-card-mutable ${project.is_mutable ? 'project-card-mutable-yes' : 'project-card-mutable-no'}`}
                        >
                          {project.is_mutable ? t('mutable') : t('immutable')}
                        </span>
                      </div>
                      <span className="project-card-meta">{t('markedDays', { count: project.marked_count })}</span>
                    </div>
                    <span className="project-card-chevron" aria-hidden="true">
                      <ChevronRight size={20} />
                    </span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {user && (
        <CreateProjectModal
          isOpen={isModalOpen}
          userId={user.id}
          onClose={() => setIsModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </Layout>
  );
}
