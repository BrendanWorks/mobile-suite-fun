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
// 5=Booze(45), 6=Sports(46), 7=Money(47), 8=Hipsters(48), 9=Health(49)
const PLAYLIST_SEQUENCE = [22, 42, 43, 44, 45, 46, 47, 48, 49];

console.log('📋 PLAYLIST_SEQUENCE initialized:', PLAYLIST_SEQUENCE);

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
    } catch (error) {
      console.error('Error clearing anonymous session:', error);
    }
  },

  getCurrentPlaylistId(): number {
    const session = this.get();
    const playlistId = session?.currentPlaylistId || PLAYLIST_SEQUENCE[0];
    console.log(`📍 getCurrentPlaylistId: ${playlistId}`, session);
    return playlistId;
  },

  advanceToNextPlaylist(): number {
    const current = this.getCurrentPlaylistId();
    const currentIndex = PLAYLIST_SEQUENCE.indexOf(current);

    // If current is not in sequence or is the last one, wrap to first
    const nextIndex = currentIndex === -1 || currentIndex >= PLAYLIST_SEQUENCE.length - 1
      ? 0
      : currentIndex + 1;

    const next = PLAYLIST_SEQUENCE[nextIndex];
    this.update({ currentPlaylistId: next, completedRounds: 0, roundScores: [] });
    console.log(`📋 Advanced from playlist ${current} to ${next} (index ${currentIndex} → ${nextIndex})`);
    return next;
  },

  isLastPlaylist(): boolean {
    const current = this.getCurrentPlaylistId();
    const currentIndex = PLAYLIST_SEQUENCE.indexOf(current);
    const isLast = currentIndex === PLAYLIST_SEQUENCE.length - 1;
    console.log(`🔍 isLastPlaylist check: current=${current}, index=${currentIndex}, isLast=${isLast}`);
    return isLast;
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
