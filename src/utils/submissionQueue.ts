const QUEUE_KEY = 'rowdy_queue';
const MAX_RETRIES = 3;

export interface QueuedSubmission {
  id: string;
  sessionId: string;
  userId: string;
  playlistId: number | null;
  session: {
    totalScore: number;
    maxPossible: number;
    percentage: number;
    grade: string;
    playtimeSeconds: number;
  };
  results: Array<{
    gameId: number | string;
    puzzleId: number;
    roundNumber: number;
    rawScore: number;
    maxScore: number;
    normalizedScore: number;
    grade: string;
  }>;
  roundCount: number;
  displayName: string;
  timestamp: number;
  retryCount: number;
}

export function getQueue(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedSubmission[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedSubmission[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable - silent fail
  }
}

export function addToQueue(submission: Omit<QueuedSubmission, 'id' | 'timestamp' | 'retryCount'>): QueuedSubmission {
  const queue = getQueue();
  const entry: QueuedSubmission = {
    ...submission,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(entry);
  writeQueue(queue);
  return entry;
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter(s => s.id !== id);
  writeQueue(queue);
}

export function incrementRetryCount(id: string): void {
  const queue = getQueue().map(s =>
    s.id === id ? { ...s, retryCount: s.retryCount + 1 } : s
  );
  writeQueue(queue);
}

export function getRetryableItems(): QueuedSubmission[] {
  return getQueue().filter(s => s.retryCount < MAX_RETRIES);
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
