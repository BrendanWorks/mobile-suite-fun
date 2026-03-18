import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { GameHandle } from "../lib/gameTypes";
import { audioManager } from "../lib/audioManager";

const MAX_SCORE_PER_COMPARISON = 250;
const ROUND_DURATION_S = 90;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemData {
  name: string;
  tagline: string;
  value: string | null;
  unit: string | null;
  image_url: string | null;
}

interface Comparison {
  comparison_type: string;
  correct_answer: string;
  reveal_note: string;
  anchor: ItemData;
  challenger: ItemData;
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

async function loadFromSuperlativePuzzles(ids: number | number[]): Promise<Comparison[]> {
  const idArray = Array.isArray(ids) ? ids : [ids];
  const { data: puzzles, error } = await supabase
    .from("superlative_puzzles")
    .select("id, comparison_type, correct_answer, reveal_note, superlative_items(role, name, tagline, value, unit, image_url)")
    .in("id", idArray);

  if (error || !puzzles || puzzles.length === 0) return [];

  const byId = new Map(puzzles.map((p: any) => [p.id, p]));
  return idArray.map((id) => {
    const p = byId.get(id);
    if (!p) return null;
    const items: any[] = p.superlative_items ?? [];
    const anchor = items.find((i: any) => i.role === "anchor");
    const challenger = items.find((i: any) => i.role === "challenger");
    if (!anchor || !challenger) return null;
    return {
      comparison_type: p.comparison_type,
      correct_answer: p.correct_answer,
      reveal_note: p.reveal_note,
      anchor: { name: anchor.name, tagline: anchor.tagline, value: anchor.value, unit: anchor.unit, image_url: anchor.image_url },
      challenger: { name: challenger.name, tagline: challenger.tagline, value: challenger.value, unit: challenger.unit, image_url: challenger.image_url },
    };
  }).filter(Boolean) as Comparison[];
}

async function loadFromPuzzleMetadata(id: number): Promise<Comparison[]> {
  const { data, error } = await supabase
    .from("puzzles")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return [];

  const rawComparisons = data.metadata?.comparisons ?? [];
  return rawComparisons.map((c: any) => ({
    comparison_type: c.question?.replace(/^which (is|has more) /i, "").replace(/\?$/, "") ?? "Bigger",
    correct_answer: c.correct_answer,
    reveal_note: c.fact ?? "",
    anchor: { name: c.option_a, tagline: c.option_a_subtitle ?? "", value: null, unit: null, image_url: null },
    challenger: { name: c.option_b, tagline: c.option_b_subtitle ?? "", value: null, unit: null, image_url: null },
  }));
}

async function loadRandomComparisons(count: number): Promise<Comparison[]> {
  const { data, error } = await supabase
    .from("superlative_puzzles")
    .select("id, comparison_type, correct_answer, reveal_note, superlative_items(role, name, tagline, value, unit, image_url)")
    .eq("is_active", true)
    .limit(20);

  if (error || !data) return DEMO_COMPARISONS;

  const all: Comparison[] = [];
  for (const p of data) {
    const items: any[] = (p as any).superlative_items ?? [];
    const anchor = items.find((i: any) => i.role === "anchor");
    const challenger = items.find((i: any) => i.role === "challenger");
    if (!anchor || !challenger) continue;
    all.push({
      comparison_type: (p as any).comparison_type,
      correct_answer: (p as any).correct_answer,
      reveal_note: (p as any).reveal_note,
      anchor: { name: anchor.name, tagline: anchor.tagline, value: anchor.value, unit: anchor.unit, image_url: anchor.image_url },
      challenger: { name: challenger.name, tagline: challenger.tagline, value: challenger.value, unit: challenger.unit, image_url: challenger.image_url },
    });
  }

  if (all.length === 0) return DEMO_COMPARISONS;
  return [...all].sort(() => Math.random() - 0.5).slice(0, count);
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

const DEMO_COMPARISONS: Comparison[] = [
  {
    comparison_type: "Heavier",
    correct_answer: "Small Cumulus Cloud",
    reveal_note: "A typical cumulus cloud weighs ~500,000 kg — the water droplets are spread across a huge volume.",
    anchor: { name: "Statue of Liberty", tagline: "Gift from France, somehow", value: "204,000", unit: "kg", image_url: null },
    challenger: { name: "Small Cumulus Cloud", tagline: "Looks harmless enough", value: "500,000", unit: "kg", image_url: null },
  },
];

// ─── Option Card ──────────────────────────────────────────────────────────────

type CardState = "idle" | "selected" | "correct" | "wrong" | "dimmed" | "timeout";

interface OptionCardProps {
  item: ItemData;
  state: CardState;
  onClick: () => void;
  isRevealing: boolean;
}

function OptionCard({ item, state, onClick, isRevealing }: OptionCardProps) {
  const isDisabled = state !== "idle" && state !== "selected";
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";
  const isTimeout = state === "timeout";

  const borderColor = isCorrect
    ? "rgba(34,197,94,1)"
    : isWrong
    ? "rgba(239,68,68,1)"
    : isTimeout
    ? "rgba(239,68,68,0.7)"
    : state === "selected"
    ? "rgba(0,255,255,0.8)"
    : state === "dimmed"
    ? "rgba(0,255,255,0.08)"
    : "rgba(0,255,255,0.3)";

  const boxShadow = isCorrect
    ? "0 0 30px rgba(34,197,94,0.5), inset 0 0 20px rgba(34,197,94,0.1)"
    : isWrong
    ? "0 0 25px rgba(239,68,68,0.4), inset 0 0 15px rgba(239,68,68,0.08)"
    : state === "selected"
    ? "0 0 20px rgba(0,255,255,0.3)"
    : "0 0 10px rgba(0,255,255,0.08)";

  const bg = isCorrect
    ? "rgba(34,197,94,0.08)"
    : isWrong
    ? "rgba(239,68,68,0.08)"
    : state === "selected"
    ? "rgba(0,255,255,0.06)"
    : "rgba(0,0,0,0.5)";

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`relative w-full rounded-2xl border-2 overflow-hidden transition-all duration-200 text-left ${
        isDisabled ? "cursor-default" : "cursor-pointer active:scale-95"
      } ${state === "dimmed" ? "opacity-50" : ""}`}
      style={{ borderColor, boxShadow, background: bg }}
    >
      {(isCorrect || isWrong) && (
        <div
          className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
            isCorrect ? "bg-green-500 text-black" : "bg-red-500 text-white"
          }`}
          style={{ boxShadow: isCorrect ? "0 0 12px rgba(34,197,94,0.9)" : "0 0 12px rgba(239,68,68,0.9)" }}
        >
          {isCorrect ? "✓" : "✗"}
        </div>
      )}

      {item.image_url && (
        <div className="w-full aspect-[4/3] overflow-hidden">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            style={{ opacity: state === "dimmed" ? 0.5 : 1 }}
          />
        </div>
      )}

      <div className="p-3">
        <p
          className="text-white font-bold text-base leading-snug"
          style={{ textShadow: "0 0 8px rgba(255,255,255,0.2)" }}
        >
          {item.name}
        </p>
        {item.tagline && (
          <p className="text-cyan-400/60 text-xs italic mt-0.5 leading-snug">
            {item.tagline}
          </p>
        )}
        {isRevealing && item.value && item.unit && (
          <p
            className="text-yellow-400 font-black text-sm mt-1"
            style={{ textShadow: "0 0 10px rgba(251,191,36,0.7)" }}
          >
            {item.value} {item.unit}
          </p>
        )}
      </div>
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
  const [selectedSide, setSelectedSide] = useState<"anchor" | "challenger" | null>(null);
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
    setSelectedSide(null);
    setTotalScore(0);
    totalScoreRef.current = 0;
    setResults([]);
    setSecondsLeft(ROUND_DURATION_S);

    const load = async () => {
      let loaded: Comparison[] = [];

      if (puzzleIds && puzzleIds.length > 0) {
        loaded = await loadFromSuperlativePuzzles(puzzleIds);
      } else if (puzzleId !== null && puzzleId !== undefined) {
        loaded = await loadFromSuperlativePuzzles(puzzleId);
        if (loaded.length === 0) {
          loaded = await loadFromPuzzleMetadata(puzzleId);
        }
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
  const isRevealing = roundState === "revealing";
  const isTimedOut = roundState === "timeout-pulsing";

  const getGameScore = useCallback(
    () => ({ score: totalScoreRef.current, maxScore }),
    [maxScore]
  );

  useImperativeHandle(ref, () => ({
    getGameScore,
    onGameEnd: () => {},
    pauseTimer: isRevealing,
    hideTimer: true,
  }), [getGameScore, isRevealing]);

  const handleAnswer = useCallback(
    (side: "anchor" | "challenger") => {
      if (!currentComparison || roundState !== "playing") return;
      const chosen = side === "anchor" ? currentComparison.anchor.name : currentComparison.challenger.name;
      const isCorrect = chosen === currentComparison.correct_answer;
      const score = isCorrect ? MAX_SCORE_PER_COMPARISON : 0;

      setSelectedSide(side);
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
      setSelectedSide(null);
      setRoundState("playing");
    }
  }, [roundState, isLastComparison, finishRound]);

  const getCardState = (side: "anchor" | "challenger"): CardState => {
    if (isTimedOut) return "timeout";
    if (roundState === "playing") {
      return selectedSide === side ? "selected" : "idle";
    }
    if (isRevealing && currentComparison) {
      const itemName = side === "anchor" ? currentComparison.anchor.name : currentComparison.challenger.name;
      const isChosen = selectedSide === side;
      const isCorrectOption = itemName === currentComparison.correct_answer;
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
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center text-cyan-400">
          <div className="text-lg" style={{ textShadow: "0 0 10px #00ffff" }}>Loading...</div>
          <div className="text-sm text-cyan-300/60 mt-2">Preparing comparisons</div>
        </div>
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  if (roundState === "complete") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="h-full bg-black flex items-start justify-center p-4 pt-6 overflow-y-auto">
        <div className="text-center max-w-sm w-full text-white">
          <h2 className="text-2xl font-bold text-cyan-400 mb-1" style={{ textShadow: "0 0 10px #00ffff" }}>
            Round Complete
          </h2>
          <p className="text-cyan-300/60 text-sm mb-5">{correct}/{results.length} correct</p>
          <div className="bg-black border-2 border-cyan-400/40 rounded-2xl p-4 mb-5" style={{ boxShadow: "0 0 20px rgba(0,255,255,0.15)" }}>
            <p className="text-cyan-300/60 text-xs mb-1">Total Score</p>
            <p className="text-yellow-400 text-5xl font-black" style={{ textShadow: "0 0 20px #fbbf24" }}>
              {totalScore}
            </p>
          </div>
          {results.map((r, i) => (
            <div key={i} className={`flex justify-between items-center py-1.5 px-3 rounded-lg mb-1 text-sm ${r.correct ? "text-green-400" : "text-red-400"}`}>
              <span>{r.correct ? "✓" : "✗"} Round {i + 1}</span>
              <span className="font-bold">{r.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Playing / Revealing ───────────────────────────────────────────────────

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 pt-1 pb-2">
        <div className="max-w-sm mx-auto w-full text-white">

          {/* Timer bar */}
          <div
            className="w-full h-1.5 rounded-full overflow-hidden mb-3"
            style={{ background: "rgba(0,255,255,0.1)", boxShadow: isDanger ? "0 0 6px rgba(239,68,68,0.2)" : "0 0 6px rgba(0,255,255,0.1)" }}
          >
            <div
              className="h-full transition-all duration-1000 ease-linear rounded-full"
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

          {/* Question header */}
          <div className="text-center mb-4">
            <p className="text-cyan-400 text-lg font-medium" style={{ textShadow: "0 0 10px rgba(0,255,255,0.6)" }}>
              Which is
            </p>
            <p
              className="font-black leading-none uppercase"
              style={{
                fontSize: "clamp(2.4rem, 13vw, 3.8rem)",
                color: "#fbbf24",
                textShadow: "0 0 30px rgba(251,191,36,0.8), 0 0 60px rgba(251,191,36,0.3)",
                letterSpacing: "-0.02em",
              }}
            >
              {currentComparison.comparison_type}?
            </p>
          </div>

          {/* Option cards side by side */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <OptionCard
              item={currentComparison.anchor}
              state={getCardState("anchor")}
              onClick={() => handleAnswer("anchor")}
              isRevealing={isRevealing}
            />
            <OptionCard
              item={currentComparison.challenger}
              state={getCardState("challenger")}
              onClick={() => handleAnswer("challenger")}
              isRevealing={isRevealing}
            />
          </div>

          {/* Info / reveal box */}
          <div
            className="rounded-2xl border-2 px-4 py-3 mb-3 transition-all duration-300"
            style={{
              borderColor: isTimedOut ? "rgba(239,68,68,0.5)" : isRevealing ? "rgba(0,255,255,0.4)" : "rgba(0,255,255,0.1)",
              boxShadow: isTimedOut ? "0 0 20px rgba(239,68,68,0.3)" : isRevealing ? "0 0 20px rgba(0,255,255,0.15)" : "none",
              background: "rgba(0,0,0,0.6)",
              minHeight: "4rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isTimedOut ? (
              <p className="text-red-400 font-black text-center animate-pulse" style={{ fontSize: "clamp(1.4rem, 7vw, 2rem)", textShadow: "0 0 20px #f87171" }}>
                Time's Up!
              </p>
            ) : !isRevealing ? (
              <p className="text-cyan-400/20 font-black text-center" style={{ fontSize: "clamp(1.8rem, 9vw, 2.6rem)", letterSpacing: "-0.02em" }}>
                Guess
              </p>
            ) : (
              <p className="text-cyan-300 text-sm leading-relaxed text-center">
                {currentComparison.reveal_note}
              </p>
            )}
          </div>

          {/* Next button */}
          <button
            onClick={isRevealing ? onNext : undefined}
            disabled={!isRevealing}
            className="w-full py-3 bg-transparent border-2 rounded-2xl text-sm font-bold transition-all"
            style={{
              borderColor: isRevealing ? "#ec4899" : "rgba(236,72,153,0.15)",
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
