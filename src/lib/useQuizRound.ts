import { useState, useEffect, useRef, useCallback } from "react";
import { audioManager } from "./audioManager";

export const PUZZLES_PER_ROUND = 3;
export const MAX_SCORE_PER_PUZZLE = 250;
export const MAX_ROUND_SCORE = MAX_SCORE_PER_PUZZLE * PUZZLES_PER_ROUND;
export const ROUND_DURATION_S = 60;

export type RoundState = "loading" | "playing" | "revealing" | "timeout-pulsing" | "complete";

export interface RoundResult {
  puzzleId: number;
  correct: boolean;
  score: number;
}

interface UseQuizRoundOptions<T> {
  puzzleIds?: number[] | null;
  puzzleId?: number | null;
  loadById: (id: number) => Promise<T | null>;
  loadRandom: (count: number) => Promise<T[]>;
  demoPuzzles: T[];
  getPuzzleId: (puzzle: T) => number;
  audioWinKey: string;
  audioWrongKey: string;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
}

export function useQuizRound<T>({
  puzzleIds,
  puzzleId,
  loadById,
  loadRandom,
  demoPuzzles,
  getPuzzleId,
  audioWinKey,
  audioWrongKey,
  onScoreUpdate,
  onComplete,
  timeRemaining,
}: UseQuizRoundOptions<T>) {
  const [puzzles, setPuzzles] = useState<T[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>("loading");
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_S);

  const scoreRef = useRef(0);
  const totalScoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundStateRef = useRef<RoundState>("loading");
  const completedRef = useRef(false);

  // Keep roundStateRef in sync so the timer callback can read current state
  // without causing re-renders
  useEffect(() => {
    roundStateRef.current = roundState;
  }, [roundState]);

  const currentPuzzle = puzzles[currentIndex] ?? null;
  const isLastPuzzle = currentIndex + 1 >= puzzles.length;
  const isDanger = secondsLeft <= 10 || roundState === "timeout-pulsing";
  const timerProgress = (secondsLeft / ROUND_DURATION_S) * 100;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stable ref for onComplete so the timeout-pulsing effect doesn't
  // cancel/restart every time the parent re-renders
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const timeRemainingRef = useRef(timeRemaining);
  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  // Single timer that only ticks when playing; uses ref to check state
  // so it doesn't restart when roundState flips to "revealing"
  useEffect(() => {
    if (roundState === "loading" || roundState === "timeout-pulsing" || roundState === "complete") {
      stopTimer();
      return;
    }

    // Already running — don't create a second interval
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      // Only decrement while we're in playing state (not revealing)
      if (roundStateRef.current !== "playing") return;

      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          setRoundState("timeout-pulsing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return stopTimer;
  }, [roundState, stopTimer]);

  // Timeout-pulsing → complete after 3 s (uses stable refs to avoid cancellation)
  useEffect(() => {
    if (roundState !== "timeout-pulsing") return;

    const t = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      setRoundState("complete");
      onCompleteRef.current?.(totalScoreRef.current, MAX_ROUND_SCORE, timeRemainingRef.current);
    }, 3000);

    return () => clearTimeout(t);
  }, [roundState]);

  useEffect(() => {
    audioManager.loadSound(audioWinKey, "/sounds/global/win_optimized.mp3", 2);
    audioManager.loadSound(audioWrongKey, "/sounds/global/wrong_optimized.mp3", 2);
  }, [audioWinKey, audioWrongKey]);

  const puzzleIdsKey = JSON.stringify(puzzleIds);

  useEffect(() => {
    completedRef.current = false;
    const load = async () => {
      setRoundState("loading");
      try {
        let loaded: T[] = [];

        if (puzzleIds && puzzleIds.length > 0) {
          const fetched = await Promise.all(puzzleIds.map(loadById));
          loaded = fetched.filter(Boolean) as T[];
        } else if (puzzleId) {
          const single = await loadById(puzzleId);
          if (single) loaded = [single];
        }

        if (loaded.length === 0) {
          loaded = await loadRandom(PUZZLES_PER_ROUND);
        }

        setPuzzles(loaded.length > 0 ? loaded : demoPuzzles);
        setRoundState("playing");
      } catch {
        setPuzzles(demoPuzzles);
        setRoundState("playing");
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleIdsKey, puzzleId]);

  const recordAnswer = useCallback(
    (isCorrect: boolean, puzzleIdOverride?: number) => {
      if (!currentPuzzle) return;

      const score = isCorrect ? MAX_SCORE_PER_PUZZLE : 0;

      if (isCorrect) audioManager.play(audioWinKey);
      else audioManager.play(audioWrongKey, 0.3);

      setRoundState("revealing");

      const newTotal = totalScoreRef.current + score;
      setTotalScore(newTotal);
      scoreRef.current = newTotal;
      totalScoreRef.current = newTotal;

      setResults((prev) => [
        ...prev,
        { puzzleId: puzzleIdOverride ?? getPuzzleId(currentPuzzle), correct: isCorrect, score },
      ]);

      onScoreUpdate?.(newTotal, MAX_ROUND_SCORE);
    },
    [currentPuzzle, audioWinKey, audioWrongKey, getPuzzleId, onScoreUpdate]
  );

  const handleNext = useCallback(
    (onAdvance?: () => void) => {
      if (isLastPuzzle) {
        stopTimer();
        if (completedRef.current) return;
        completedRef.current = true;
        setRoundState("complete");
        onCompleteRef.current?.(totalScoreRef.current, MAX_ROUND_SCORE, timeRemainingRef.current);
      } else {
        setCurrentIndex((i) => i + 1);
        onAdvance?.();
        setRoundState("playing");
      }
    },
    [isLastPuzzle, stopTimer]
  );

  const getGameScore = useCallback(
    () => ({ score: scoreRef.current, maxScore: MAX_ROUND_SCORE }),
    []
  );

  return {
    puzzles,
    currentPuzzle,
    currentIndex,
    roundState,
    results,
    totalScore,
    secondsLeft,
    isDanger,
    timerProgress,
    isLastPuzzle,
    stopTimer,
    recordAnswer,
    handleNext,
    getGameScore,
  };
}
