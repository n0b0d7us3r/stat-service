import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import type { Achievement } from '../db/types';
import '../styles/components/AchievementCelebrationModal.css';

interface AchievementCelebrationModalProps {
  achievement: Achievement | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AchievementCelebrationModal({
  achievement,
  isOpen,
  onClose,
}: AchievementCelebrationModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !achievement) {
    return null;
  }

  return (
    <div className="achievement-celebration-overlay">
      <div className="achievement-celebration-stack">
        <div
          className="achievement-celebration-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievement-celebration-title"
        >
          <div className="achievement-celebration-glow" aria-hidden="true" />

          <div className="achievement-celebration-content">
            <div className="achievement-celebration-icon" aria-hidden="true">
              <Trophy size={40} />
            </div>

            <p className="achievement-celebration-badge">Достижение получено!</p>
            <h2 id="achievement-celebration-title" className="achievement-celebration-title">
              {achievement.name}
            </h2>
            <p className="achievement-celebration-description">{achievement.description}</p>
          </div>
        </div>

        <button type="button" className="achievement-celebration-btn" onClick={onClose}>
          Я МОЛОДЕЦ
        </button>
      </div>
    </div>
  );
}
