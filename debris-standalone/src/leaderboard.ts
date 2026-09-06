// Client for the /api/leaderboard Netlify Function (netlify/functions/leaderboard.mts).
// The server is the sole authority on what actually makes the top 10; this
// module's `qualifies` check is only a UX gate, so the initials ceremony
// isn't shown to a run that obviously isn't close. If the cache is stale
// (or missing), the worst case is showing the ceremony to a run that
// doesn't quite make it -- the server still just quietly returns rank:null.

export interface LeaderboardEntry {
  initials: string;
  score: number;
  wave: number;
  rocksDestroyed: number;
  ts: number;
}

export interface PendingSubmission {
  initials: string;
  score: number;
  wave: number;
  rocksDestroyed: number;
  durationMs: number;
}

export interface SubmitResult {
  list: LeaderboardEntry[];
  rank: number | null;
}

const ENDPOINT = '/api/leaderboard';
const CACHE_KEY = 'debris_leaderboard_cache';
const QUEUE_KEY = 'debris_pending_scores';
const MAX_ENTRIES = 10;
const MAX_QUEUE_LEN = 20;

function readCache(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

function writeCache(list: LeaderboardEntry[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function readQueue(): PendingSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingSubmission[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: PendingSubmission[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE_LEN))); } catch { /* ignore */ }
}

// Falls back to the last successful fetch when offline or the function is
// unreachable, so the qualifying check and the board itself still have
// something to show instead of going blank.
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(String(res.status));
    const list = (await res.json()) as LeaderboardEntry[];
    writeCache(list);
    return list;
  } catch {
    return readCache();
  }
}

export function qualifies(score: number, list: LeaderboardEntry[]): boolean {
  if (score <= 0) return false;
  if (list.length < MAX_ENTRIES) return true;
  return score > list[list.length - 1].score;
}

async function postScore(entry: PendingSubmission): Promise<SubmitResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (res.status === 429) {
    // Shared-IP throttle -- wait out the window and try exactly once more,
    // so two friends playing back to back on the same wifi don't see an
    // error for something that isn't really abuse.
    await new Promise((r) => setTimeout(r, 5500));
    const retry = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!retry.ok) throw new Error(String(retry.status));
    return retry.json() as Promise<SubmitResult>;
  }
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<SubmitResult>;
}

// Submits now; if that fails (offline, function unreachable), queues the
// score in localStorage for flushQueue to retry later rather than losing
// a real result the player earned.
export async function submitScore(entry: PendingSubmission): Promise<SubmitResult | null> {
  try {
    const result = await postScore(entry);
    writeCache(result.list);
    void flushQueue();
    return result;
  } catch {
    const q = readQueue();
    q.push(entry);
    writeQueue(q);
    return null;
  }
}

let flushing = false;

// Best-effort retry of anything queued while offline. Safe to call often
// (app load, an 'online' event) -- it no-ops immediately if empty or
// already running.
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  const queued = readQueue();
  if (queued.length === 0) return;
  flushing = true;
  try {
    const remaining: PendingSubmission[] = [];
    for (const entry of queued) {
      try {
        const result = await postScore(entry);
        writeCache(result.list);
      } catch {
        remaining.push(entry);
      }
    }
    writeQueue(remaining);
  } finally {
    flushing = false;
  }
}
