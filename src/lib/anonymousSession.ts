interface AnonymousSession {
  currentPlaylistId: number;
  completedRounds: number;
  roundScores: Array<{
    gameId: string;
    gameName: string;
    rawScore: number;
    maxScore: number;
    normalizedScore: number;
    grade: string;
  }>;
  lastUpdated: number;
}

const STORAGE_KEY = 'rowdy_anonymous_session';

// Ordered playlist sequence - DO NOT MODIFY THIS ORDER!
// 1=Wildly Inappropriate(22), 2=Junk Food(42), 3=Music(43), 4=Plot Twist(44),
// 5=Booze(45), 6=Sports(46), 7=Money(47), 8=Hipsters(48), 9=Health(49), 10=Crazy World(52)
const PLAYLIST_SEQUENCE = [22, 42, 43, 44, 45, 46, 47, 48, 49, 52];

export const anonymousSessionManager = {
  get(): AnonymousSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  save(session: AnonymousSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
    }
  },

  update(updates: Partial<AnonymousSession>): void {
    const current = this.get() || {
      currentPlaylistId: PLAYLIST_SEQUENCE[0],
      completedRounds: 0,
      roundScores: [],
      lastUpdated: Date.now()
    };
    this.save({ ...current, ...updates, lastUpdated: Date.now() });
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  },

  getCurrentPlaylistId(): number {
    const session = this.get();
    return session?.currentPlaylistId || PLAYLIST_SEQUENCE[0];
  },

  advanceToNextPlaylist(): number {
    const current = this.getCurrentPlaylistId();
    const currentIndex = PLAYLIST_SEQUENCE.indexOf(current);

    const nextIndex = currentIndex === -1 || currentIndex >= PLAYLIST_SEQUENCE.length - 1
      ? 0
      : currentIndex + 1;

    const next = PLAYLIST_SEQUENCE[nextIndex];
    this.update({ currentPlaylistId: next, completedRounds: 0, roundScores: [] });
    return next;
  },

  isLastPlaylist(): boolean {
    const current = this.getCurrentPlaylistId();
    const currentIndex = PLAYLIST_SEQUENCE.indexOf(current);
    return currentIndex === PLAYLIST_SEQUENCE.length - 1;
  },

  reset(): void {
    this.save({
      currentPlaylistId: PLAYLIST_SEQUENCE[0],
      completedRounds: 0,
      roundScores: [],
      lastUpdated: Date.now()
    });
  },

  // Debug helper
  getPlaylistSequence(): number[] {
    return [...PLAYLIST_SEQUENCE];
  },

  // Debug helper to see what's next
  getNextPlaylistId(): number {
    const current = this.getCurrentPlaylistId();
    const currentIndex = PLAYLIST_SEQUENCE.indexOf(current);
    const nextIndex = currentIndex === -1 || currentIndex >= PLAYLIST_SEQUENCE.length - 1
      ? 0
      : currentIndex + 1;
    return PLAYLIST_SEQUENCE[nextIndex];
  }
};
