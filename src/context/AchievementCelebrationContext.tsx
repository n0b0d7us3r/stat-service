import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AchievementCelebrationModal } from '../components/AchievementCelebrationModal';
import { ConfettiPopper } from '../components/ConfettiPopper';
import { syncUserAchievements } from '../api/achievements';
import type { Achievement } from '../types';
import { useAuth } from './AuthContext';

interface AchievementCelebrationContextValue {
  celebrateAchievements: () => Promise<Achievement[]>;
  showAchievements: (achievements: Achievement[]) => void;
}

const AchievementCelebrationContext = createContext<AchievementCelebrationContextValue | null>(null);

export function AchievementCelebrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [celebrationQueue, setCelebrationQueue] = useState<Achievement[]>([]);

  const currentCelebration = celebrationQueue[0] ?? null;
  const celebrationOpen = celebrationQueue.length > 0;

  const showAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length > 0) {
      setCelebrationQueue((queue) => [...queue, ...achievements]);
    }
  }, []);

  const celebrateAchievements = useCallback(async () => {
    if (!user) {
      return [];
    }

    const newlyEarned = await syncUserAchievements(user.id);
    showAchievements(newlyEarned);

    return newlyEarned;
  }, [showAchievements, user]);

  const closeCelebration = useCallback(() => {
    setCelebrationQueue((queue) => queue.slice(1));
  }, []);

  const value = useMemo(
    () => ({ celebrateAchievements, showAchievements }),
    [celebrateAchievements, showAchievements],
  );

  return (
    <AchievementCelebrationContext.Provider value={value}>
      {children}
      <ConfettiPopper active={celebrationOpen} burstKey={currentCelebration?.id ?? null} />
      <AchievementCelebrationModal
        achievement={currentCelebration}
        isOpen={celebrationOpen}
        onClose={closeCelebration}
      />
    </AchievementCelebrationContext.Provider>
  );
}

export function useAchievementCelebration(): AchievementCelebrationContextValue {
  const context = useContext(AchievementCelebrationContext);

  if (!context) {
    throw new Error('useAchievementCelebration must be used within AchievementCelebrationProvider');
  }

  return context;
}
