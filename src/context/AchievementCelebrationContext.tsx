import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AchievementCelebrationModal } from '../components/AchievementCelebrationModal';
import { ConfettiPopper } from '../components/ConfettiPopper';
import { syncUserAchievements } from '../db/achievements';
import type { Achievement } from '../db/types';
import { useAuth } from './AuthContext';

interface AchievementCelebrationContextValue {
  celebrateAchievements: () => Achievement[];
}

const AchievementCelebrationContext = createContext<AchievementCelebrationContextValue | null>(null);

export function AchievementCelebrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [celebrationQueue, setCelebrationQueue] = useState<Achievement[]>([]);

  const currentCelebration = celebrationQueue[0] ?? null;
  const celebrationOpen = celebrationQueue.length > 0;

  const celebrateAchievements = useCallback(() => {
    if (!user) {
      return [];
    }

    const newlyEarned = syncUserAchievements(user.id);

    if (newlyEarned.length > 0) {
      setCelebrationQueue((queue) => [...queue, ...newlyEarned]);
    }

    return newlyEarned;
  }, [user]);

  const closeCelebration = useCallback(() => {
    setCelebrationQueue((queue) => queue.slice(1));
  }, []);

  const value = useMemo(
    () => ({ celebrateAchievements }),
    [celebrateAchievements],
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
