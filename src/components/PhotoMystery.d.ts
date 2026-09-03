import { ComponentType } from 'react';

// PhotoMystery is authored in JSX; this declares its shape for TypeScript
// callers. Props mirror what GameSession/DebugMode pass to every game.
declare const PhotoMystery: ComponentType<{
  puzzleId?: number | null;
  puzzleIds?: number[] | null;
  rankingPuzzleId?: number | null;
  prefetchedPuzzles?: unknown[] | null;
  debugMode?: boolean;
  onQuit?: () => void;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}>;

export default PhotoMystery;
