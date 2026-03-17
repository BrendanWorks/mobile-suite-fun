import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { GameHandle } from "../lib/gameTypes";
import { audioManager } from "../lib/audioManager";

const MAX_SCORE_PER_COMPARISON = 250;
const ROUND_DURATION_S = 90;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Comparison {
  question: string;
  option_a: string;
  option_a_subtitle?: string;
  option_a_tagline?: string;
  option_b: string;
  option_b_subtitle?: string;
  correct_answer: string;
  fact: string;
}

interface GameProps {
  puzzleIds?: number[] | null;
  puzzleId?: number | null;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

type RoundState = "loading" | "playing" | "revealing" | "timeout-pulsing" | "complete";

// ─── DB Loaders ───────────────────────────────────────────────────────────────

async function loadComparisonsFromDB(id: number): Promise<Comparison[]> {
  const { data, error } = await supabase
    .from("puzzles")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return [];
  return (data.metadata?.comparisons ?? []) as Comparison[];
}

async function loadRandomComparisons(count: number): Promise<Comparison[]> {
  const { data, error } = await supabase
    .from("puzzles")
    .select("id, metadata")
    .eq("game_type", "superlative")
    .limit(10);

  if (error || !data || data.length === 0) return DEMO_COMPARISONS;

  const all: Comparison[] = [];
  for (const row of data) {
    const comparisons: Comparison[] = row.metadata?.comparisons ?? [];
    all.push(...comparisons);
  }

  if (all.length === 0) return DEMO_COMPARISONS;
  return [...all].sort(() => Math.random() - 0.5).slice(0, count);
}

// ─── Fallback demo comparisons ────────────────────────────────────────────────

const DEMO_COMPARISONS: Comparison[] = [
  {
    question: "Which is heavier?",
    option_a: "Statue of Liberty",
    option_a_subtitle: "Gift from France, somehow",
    option_b: "Small Cumulus Cloud",
    option_b_subtitle: "Looks harmless enough",
    correct_answer: "Small Cumulus Cloud",
    fact: "A typical cumulus cloud weighs ~500,000 kg — the water droplets are spread across a huge volume.",
  },
  {
    question: "Which is longer?",
    option_a: "Hollywood Walk of Fame",
    option_a_subtitle: "Noted tourist trap",
    option_b: "Coney Island Boardwalk",
    option_b_subtitle: "Rides and hotdogs",
    correct_answer: "Coney Island Boardwalk",
    fact: "Coney Island's boardwalk stretches 4 km — almost double the 2.4 km Hollywood Walk of Fame.",
  },
  {
    question: "Which is heavier?",
    option_a: "Blue Whale",
    option_a_subtitle: "Biggest animal ever, allegedly",
    option_b: "Eiffel Tower",
    option_b_subtitle: "Paris's most famous eyesore",
    correct_answer: "Eiffel Tower",
    fact: "The Eiffel Tower is 7,300 tonnes of iron — about 48 blue whales.",
  },
];

// ─── Option Card Component ────────────────────────────────────────────────────

interface OptionCardProps {
  label: string;
  subtitle?: string;
  state: "idle" | "selected" | "correct" | "wrong" | "dimmed" | "timeout";
  onClick: () => void;
}

const CARD_STYLES: Record<OptionCardProps["state"], { className: string; boxShadow: string }> = {
  idle:     { className: "border-cyan-400/30 bg-black/50 hover:border-cyan-400 hover:bg-cyan-500/10 active:scale-95", boxShadow: "0 0 10px rgba(0,255,255,0.15)" },
  selected: { className: "border-cyan-400 bg-cyan-500/20",                                                             boxShadow: "0 0 15px rgba(0,255,255,0.4)" },
  correct:  { className: "border-green-500 bg-green-500/20",                                                           boxShadow: "0 0 25px rgba(34,197,94,0.6)" },
  wrong:    { className: "border-red-500 bg-red-500/20",                                                               boxShadow: "0 0 20px rgba(239,68,68,0.5)" },
  dimmed:   { className: "border-cyan-400/10 bg-black/20 opacity-40",                                                  boxShadow: "none" },
  timeout:  { className: "border-red-500 bg-red-500/10 animate-pulse",                                                 boxShadow: "0 0 25px rgba(239,68,68,0.5)" },
};

function OptionCard({ label, subtitle, state, onClick }: OptionCardProps) {
  const { className, boxShadow } = CARD_STYLES[state];
  const isDisabled = state !== "idle" && state !== "selected";

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`
        relative w-full rounded-xl border-2 p-5 text-center transition-all duration-200
        ${className}
        ${isDisabled ? "cursor-default" : "cursor-pointer touch-manipulation"}
      `}
      style={{ boxShadow }}
    >
      {state === "correct" && (
        <div
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-black font-bold text-sm"
          style={{ boxShadow: "0 0 12px rgba(34,197,94,0.8)" }}
        >
          ✓
        </div>
      )}
      {state === "wrong" && (
        <div
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-black font-bold text-sm"
          style={{ boxShadow: "0 0 12px rgba(239,68,68,0.8)" }}
        >
          ✗
        </div>
      )}

      <p
        className="text-white font-bold text-base sm:text-lg leading-snug mb-1"
        style={{ textShadow: "0 0 8px rgba(255,255,255,0.3)" }}
      >
        {label}
      </p>

      {subtitle && (
        <p className="text-cyan-400/60 text-xs italic leading-snug">
          {subtitle}
        </p>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Superlative = forwardRef<GameHandle, GameProps>(function Superlative({
  puzzleIds,
  puzzleId,
  onScoreUpdate,
  onComplete,
  timeRemaining,
}, ref) {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>("loading");
  const [selectedOption, setSelectedOption] = useState<"a" | "b" | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; score: number }[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_S);

  const totalScoreRef = useRef(0);
  const completedRef = useRef(false);
  const roundStateRef = useRef<RoundState>("loading");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const timeRemainingRef = useRef(timeRemaining);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { roundStateRef.current = roundState; }, [roundState]);

  const maxScore = comparisons.length * MAX_SCORE_PER_COMPARISON;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishRound = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopTimer();
    setRoundState("complete");
    onCompleteRef.current?.(totalScoreRef.current, maxScore, timeRemainingRef.current);
  }, [stopTimer, maxScore]);

  useEffect(() => {
    audioManager.loadSound("superlative-win", "/sounds/global/SmallWin.mp3", 2);
    audioManager.loadSound("superlative-wrong", "/sounds/global/wrong_optimized.mp3", 2);
  }, []);

  useEffect(() => {
    completedRef.current = false;
    setRoundState("loading");
    setCurrentIndex(0);
    setSelectedOption(null);
    setTotalScore(0);
    totalScoreRef.current = 0;
    setResults([]);
    setSecondsLeft(ROUND_DURATION_S);

    const effectiveId = puzzleId ?? (puzzleIds && puzzleIds.length > 0 ? puzzleIds[0] : null);

    const load = async () => {
      let loaded: Comparison[] = [];

      if (effectiveId !== null && effectiveId !== undefined) {
        loaded = await loadComparisonsFromDB(effectiveId);
      }

      if (loaded.length === 0) {
        loaded = await loadRandomComparisons(3);
      }

      setComparisons(loaded.length > 0 ? loaded : DEMO_COMPARISONS);
      setRoundState("playing");
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleId, JSON.stringify(puzzleIds)]);

  useEffect(() => {
    if (roundState !== "playing" && roundState !== "revealing") {
      stopTimer();
      return;
    }
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
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

  useEffect(() => {
    if (roundState !== "timeout-pulsing") return;
    const t = setTimeout(finishRound, 3000);
    return () => clearTimeout(t);
  }, [roundState, finishRound]);

  const isDanger = secondsLeft <= 10 || roundState === "timeout-pulsing";
  const timerProgress = (secondsLeft / ROUND_DURATION_S) * 100;
  const currentComparison = comparisons[currentIndex] ?? null;
  const isLastComparison = currentIndex + 1 >= comparisons.length;

  const getGameScore = useCallback(
    () => ({ score: totalScoreRef.current, maxScore }),
    [maxScore]
  );

  useImperativeHandle(ref, () => ({
    getGameScore,
    onGameEnd: () => {},
    pauseTimer: roundState === "revealing",
    hideTimer: true,
  }), [getGameScore, roundState]);

  const handleAnswer = useCallback(
    (choice: "a" | "b") => {
      if (!currentComparison || roundState !== "playing") return;
      const chosen = choice === "a" ? currentComparison.option_a : currentComparison.option_b;
      const isCorrect = chosen === currentComparison.correct_answer;
      const score = isCorrect ? MAX_SCORE_PER_COMPARISON : 0;

      setSelectedOption(choice);
      setRoundState("revealing");

      const newTotal = totalScoreRef.current + score;
      totalScoreRef.current = newTotal;
      setTotalScore(newTotal);
      setResults((prev) => [...prev, { correct: isCorrect, score }]);
      onScoreUpdate?.(newTotal, maxScore);

      if (isCorrect) audioManager.play("superlative-win");
      else audioManager.play("superlative-wrong", 0.3);
    },
    [currentComparison, roundState, maxScore, onScoreUpdate]
  );

  const onNext = useCallback(() => {
    if (roundState !== "revealing") return;
    if (isLastComparison) {
      finishRound();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setRoundState("playing");
    }
  }, [roundState, isLastComparison, finishRound]);

  const getCardState = (
    which: "a" | "b"
  ): "idle" | "selected" | "correct" | "wrong" | "dimmed" | "timeout" => {
    if (roundState === "timeout-pulsing") return "timeout";
    if (roundState === "playing") {
      return selectedOption === which ? "selected" : "idle";
    }
    if (roundState === "revealing") {
      const chosen = which === "a" ? currentComparison!.option_a : currentComparison!.option_b;
      const isChosen = selectedOption === which;
      const isCorrectOption = chosen === currentComparison?.correct_answer;
      if (isChosen && isCorrectOption) return "correct";
      if (isChosen && !isCorrectOption) return "wrong";
      if (!isChosen && isCorrectOption) return "correct";
      return "dimmed";
    }
    return "idle";
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (roundState === "loading" || !currentComparison) {
    return (
      <div className="h-full bg-black flex items-center justify-center p-3">
        <div className="text-center text-cyan-400">
          <div className="text-lg" style={{ textShadow: "0 0 10px #00ffff" }}>
            Loading...
          </div>
          <div className="text-sm text-cyan-300 mt-2">Preparing comparisons</div>
        </div>
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  if (roundState === "complete") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="h-full bg-black flex items-start justify-center p-3 pt-6 overflow-y-auto">
        <div className="text-center max-w-sm w-full text-white">
          <h2
            className="text-2xl font-bold text-cyan-400 mb-2"
            style={{ textShadow: "0 0 10px #00ffff" }}
          >
            Round Complete
          </h2>
          <p className="text-cyan-300 text-sm mb-6">
            {correct}/{results.length} correct
          </p>
          <div
            className="bg-black border-2 border-cyan-400/50 rounded-xl p-4 mb-6"
            style={{ boxShadow: "0 0 15px rgba(0,255,255,0.2)" }}
          >
            <p className="text-cyan-300 text-xs mb-1">Total Score</p>
            <p
              className="text-yellow-400 text-4xl font-bold"
              style={{ textShadow: "0 0 15px #fbbf24" }}
            >
              {totalScore}
            </p>
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex justify-between items-center py-1.5 px-3 rounded mb-1 text-sm ${
                r.correct ? "text-green-400" : "text-red-400"
              }`}
            >
              <span>{r.correct ? "✓" : "✗"} Round {i + 1}</span>
              <span className="font-bold">{r.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Playing / Revealing ───────────────────────────────────────────────────

  const isRevealing = roundState === "revealing";
  const isTimedOut = roundState === "timeout-pulsing";

  return (
    <div className="h-full bg-black flex items-start justify-center p-2 pt-0 overflow-y-auto">
      <div className="max-w-sm w-full text-white">

        {/* Timer bar */}
        <div
          className="w-full h-1.5 bg-black rounded-lg border overflow-hidden mb-3"
          style={{
            borderColor: isDanger ? "rgba(239,68,68,0.5)" : "rgba(0,255,255,0.5)",
            boxShadow: isDanger ? "0 0 6px rgba(239,68,68,0.2)" : "0 0 6px rgba(0,255,255,0.2)",
          }}
        >
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${timerProgress}%`,
              background: isDanger ? "#f87171" : "#22d3ee",
              boxShadow: isDanger ? "0 0 8px #f87171" : "0 0 8px #00ffff",
            }}
          />
        </div>

        {/* Progress dots */}
        {comparisons.length > 1 && (
          <div className="flex justify-center gap-2 mb-3">
            {comparisons.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: i <= currentIndex ? "#22d3ee" : "rgba(0,255,255,0.15)",
                  boxShadow: i <= currentIndex ? "0 0 6px #00ffff" : "none",
                }}
              />
            ))}
          </div>
        )}

        {/* Question prompt */}
        <div className="text-center mb-5">
          <p
            className="text-white font-black leading-tight"
            style={{
              fontSize: "clamp(1.5rem, 8vw, 2.8rem)",
              textShadow: "0 0 20px rgba(0,255,255,0.5), 0 0 40px rgba(0,255,255,0.2)",
              letterSpacing: "-0.02em",
            }}
          >
            {currentComparison.question}
          </p>
        </div>

        {/* Option cards */}
        <div className="flex flex-col gap-3 mb-4">
          <OptionCard
            label={currentComparison.option_a}
            subtitle={currentComparison.option_a_subtitle ?? currentComparison.option_a_tagline}
            state={getCardState("a")}
            onClick={() => handleAnswer("a")}
          />

          <div
            className="text-center text-cyan-400/40 font-black text-sm"
            style={{ letterSpacing: "0.3em" }}
          >
            OR
          </div>

          <OptionCard
            label={currentComparison.option_b}
            subtitle={currentComparison.option_b_subtitle}
            state={getCardState("b")}
            onClick={() => handleAnswer("b")}
          />
        </div>

        {/* Info / reveal box */}
        <div
          className="rounded-xl border-2 bg-black/80 px-4 py-3 mb-4 transition-colors duration-300 overflow-hidden"
          style={{
            borderColor: isTimedOut ? "rgba(239,68,68,0.5)" : isRevealing ? "rgba(0,255,255,0.4)" : "rgba(0,255,255,0.12)",
            boxShadow: isTimedOut ? "0 0 20px rgba(239,68,68,0.3)" : isRevealing ? "0 0 20px rgba(0,255,255,0.2)" : "none",
            minHeight: "5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isTimedOut ? (
            <p
              className="text-red-400 font-black text-center animate-pulse"
              style={{ fontSize: "clamp(1.4rem, 7vw, 2rem)", textShadow: "0 0 20px #f87171" }}
            >
              Time's Up!
            </p>
          ) : !isRevealing ? (
            <p
              className="w-full text-cyan-400/30 font-black text-center leading-none"
              style={{ fontSize: "clamp(1.8rem, 9vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Guess
            </p>
          ) : (
            <p className="text-cyan-300 text-xs leading-relaxed text-center">
              {currentComparison.fact}
            </p>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={isRevealing ? onNext : undefined}
          disabled={!isRevealing}
          className="w-full py-3 bg-transparent border-2 rounded-xl text-sm font-bold transition-all touch-manipulation"
          style={{
            borderColor: isRevealing ? "#ec4899" : "rgba(236,72,153,0.2)",
            color: isRevealing ? "#f472b6" : "rgba(244,114,182,0.2)",
            textShadow: isRevealing ? "0 0 8px #ec4899" : "none",
            boxShadow: isRevealing ? "0 0 15px rgba(236,72,153,0.3)" : "none",
            cursor: isRevealing ? "pointer" : "default",
          }}
        >
          {isLastComparison ? "Finish Round" : "Next →"}
        </button>
      </div>
    </div>
  );
});

Superlative.displayName = 'Superlative';

export default React.memo(Superlative, (prevProps, nextProps) => {
  return (
    prevProps.puzzleIds === nextProps.puzzleIds &&
    prevProps.puzzleId === nextProps.puzzleId &&
    prevProps.onScoreUpdate === nextProps.onScoreUpdate &&
    prevProps.onComplete === nextProps.onComplete &&
    prevProps.timeRemaining === nextProps.timeRemaining &&
    prevProps.duration === nextProps.duration
  );
});
