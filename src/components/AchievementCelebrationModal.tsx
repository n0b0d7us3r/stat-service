import { Trophy } from 'lucide-react';
import type { Achievement } from '../types';
import { achievementDescription, achievementName, t } from '../i18n';
import { Modal } from './Modal';
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
  return (
    <Modal title={t('achievementUnlocked')} isOpen={isOpen && achievement !== null} onClose={onClose}>
      {achievement && (
        <div className="achievement-celebration-content">
          <div className="achievement-celebration-icon" aria-hidden="true">
            <Trophy size={32} className="achievement-celebration-icon-svg" />
          </div>

          <h2 className="achievement-celebration-title">{achievementName(achievement.code, achievement.name)}</h2>
          <p className="achievement-celebration-description">{achievementDescription(achievement.code, achievement.description)}</p>

          <button type="button" className="achievement-celebration-btn" onClick={onClose}>
            {t('continue')}
          </button>
        </div>
      )}
    </Modal>
  );
}
