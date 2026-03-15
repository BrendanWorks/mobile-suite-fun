import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getQueue,
  removeFromQueue,
  incrementRetryCount,
  getRetryableItems,
  QueuedSubmission,
} from '../utils/submissionQueue';
import {
  completeGameSession,
  saveAllRoundResults,
  insertLeaderboardEntry,
} from '../lib/supabaseHelpers';

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  queueCount: number;
  syncNow: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  isSyncing: false,
  queueCount: 0,
  syncNow: () => {},
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

async function submitQueued(submission: QueuedSubmission): Promise<void> {
  await completeGameSession(
    submission.sessionId,
    submission.session.totalScore,
    submission.session.maxPossible,
    submission.session.percentage,
    submission.session.grade,
    submission.roundCount,
    submission.session.playtimeSeconds
  );

  await saveAllRoundResults(
    submission.sessionId,
    submission.userId,
    submission.results
  );

  await insertLeaderboardEntry({
    userId: submission.userId,
    score: Math.round(submission.session.totalScore),
    displayName: submission.displayName,
    playlistId: submission.playlistId,
    roundCount: submission.roundCount,
  });
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(() => getQueue().length);
  const syncLockRef = useRef(false);

  const refreshCount = useCallback(() => {
    setQueueCount(getQueue().length);
  }, []);

  const syncQueue = useCallback(async () => {
    if (syncLockRef.current) return;
    const items = getRetryableItems();
    if (items.length === 0) {
      refreshCount();
      return;
    }

    syncLockRef.current = true;
    setIsSyncing(true);

    for (const item of items) {
      try {
        await submitQueued(item);
        removeFromQueue(item.id);
      } catch {
        incrementRetryCount(item.id);
      }
    }

    setIsSyncing(false);
    syncLockRef.current = false;
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'rowdy_queue') {
        refreshCount();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshCount]);

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing, queueCount, syncNow: syncQueue }}>
      {children}
    </OfflineContext.Provider>
  );
}
