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

export const anonymousSessionManager = {
  get(): AnonymousSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading anonymous session:', error);
      return null;
    }
  },

  save(session: AnonymousSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving anonymous session:', error);
    }
  },

  update(updates: Partial<AnonymousSession>): void {
    const current = this.get() || {
      currentPlaylistId: 1,
      completedRounds: 0,
      roundScores: [],
      lastUpdated: Date.now()
    };
    this.save({ ...current, ...updates, lastUpdated: Date.now() });
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing anonymous session:', error);
    }
  },

  getCurrentPlaylistId(): number {
    const session = this.get();
    return session?.currentPlaylistId || 1;
  },

  advanceToNextPlaylist(): number {
    const current = this.getCurrentPlaylistId();
    const next = current >= 10 ? 1 : current + 1;
    this.update({ currentPlaylistId: next, completedRounds: 0, roundScores: [] });
    return next;
  },

  reset(): void {
    this.save({
      currentPlaylistId: 1,
      completedRounds: 0,
      roundScores: [],
      lastUpdated: Date.now()
    });
  }
};
