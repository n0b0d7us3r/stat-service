import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderKanban, Plus } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { useAuth } from '../context/AuthContext';
import { useAchievementCelebration } from '../context/AchievementCelebrationContext';
import { getProjectsByUser } from '../api/projects';
import type { Project } from '../types';
import '../styles/ProjectsPage.css';

const PROJECT_TYPE_LABELS: Record<Project['project_type'], string> = {
  calendar: 'Календарь',
  day: 'День',
  goals: 'Цели',
};

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
    document.title = 'Проекты | Game Stat';
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
          <PageTitle title="Проекты" subtitle="Создавайте проекты и отмечайте дни в календаре" />
          <button type="button" className="projects-create-open-btn" onClick={() => setIsModalOpen(true)}>
            <Plus size={20} strokeWidth={2.5} />
            <span>Новый проект</span>
          </button>
        </div>

        <section className="projects-list-section">
          <h2 className="projects-section-title">
            Проектов: {projects.length}
          </h2>

          {projects.length === 0 ? (
            <div className="projects-empty app-border-card">
              <FolderKanban size={32} />
              <p>Пока нет проектов. Создайте первый, чтобы начать отмечать дни.</p>
            </div>
          ) : (
            <div className="projects-list">
              {projects.map((project) => (
                <article key={project.id} className="project-card app-border-card app-border-card-accent">
                  <button
                    type="button"
                    className="project-card-main"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="project-card-content">
                      <h3>{project.name}</h3>
                      {project.description && <p>{project.description}</p>}
                      <div className="project-card-meta-row">
                        <span className="project-card-type">{PROJECT_TYPE_LABELS[project.project_type]}</span>
                        <span
                          className={`project-card-mutable ${project.is_mutable ? 'project-card-mutable-yes' : 'project-card-mutable-no'}`}
                        >
                          {project.is_mutable ? 'Изменяемый' : 'Неизменяемый'}
                        </span>
                        <span className="project-card-meta">Отмечено дней: {project.marked_count}</span>
                      </div>
                    </div>
                    <ChevronRight size={20} />
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
