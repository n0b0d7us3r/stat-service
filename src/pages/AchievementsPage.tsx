import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { APP_NAME } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { getUserAchievements } from '../api/achievements';
import type { UserAchievementView } from '../types';
import '../styles/AchievementsPage.css';

function formatEarnedDate(value: string): string {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function AchievementsPage() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<UserAchievementView[]>([]);

  useEffect(() => {
    document.title = `Достижения | ${APP_NAME}`;

    if (!user) {
      setAchievements([]);
      return;
    }

    void getUserAchievements(user.id).then(setAchievements);
  }, [user]);

  const earnedCount = achievements.filter((item) => item.earned).length;

  return (
    <Layout>
      <div className="achievements-page">
        <PageTitle
          title="Достижения"
          subtitle={`Получено ${earnedCount} из ${achievements.length}`}
        />

        <div className="achievements-list">
          {achievements.map((achievement) => (
            <article
              key={achievement.id}
              className={`achievement-card app-border-card ${achievement.earned ? 'achievement-card-earned' : 'achievement-card-locked'}`}
            >
              <div className="achievement-card-icon" aria-hidden="true">
                <Trophy size={28} />
              </div>

              <div className="achievement-card-body">
                <h2 className="achievement-card-title">{achievement.name}</h2>
                <p className="achievement-card-description">{achievement.description}</p>

                {achievement.earned && achievement.earned_at && (
                  <p className="achievement-card-earned-at">
                    Получено: {formatEarnedDate(achievement.earned_at)}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
}
