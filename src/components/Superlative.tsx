import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabase";
import { GameHandle } from "../lib/gameTypes";
import { audioManager } from "../lib/audioManager";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SuperlativeItem {
  name: string;
  tagline?: string;
  value: number;
  unit: string;
  image_url: string;
}

interface SuperlativePuzzle {
  id: number;
  comparison_type: "Longer" | "Wider" | "Heavier" | "Older" | "Taller" | "Faster" | "Bigger" | "Deeper" | "Hotter";
  anchor_item: SuperlativeItem;
  challenger_item: SuperlativeItem;
  correct_answer: string;
  reveal_note: string;
}

interface GameProps {
  puzzleIds?: number[] | null;
  puzzleId?: number | null;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

const PUZZLES_PER_ROUND = 3;
const MAX_SCORE_PER_PUZZLE = 250;
const MAX_ROUND_SCORE = MAX_SCORE_PER_PUZZLE * PUZZLES_PER_ROUND;

function calculateScore(isCorrect: boolean): number {
  return isCorrect ? MAX_SCORE_PER_PUZZLE : 0;
}

async function loadPuzzleFromDB(id: number): Promise<SuperlativePuzzle | null> {
  const { data, error } = await supabase
    .from("superlative_puzzles")
    .select(`
      id,
      comparison_type,
      correct_answer,
      reveal_note,
      superlative_items (
        id, role, name, tagline, value, unit, image_url
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const items = (data.superlative_items ?? []) as Array<{
    id: number; role: string; name: string; tagline?: string;
    value: number; unit: string; image_url: string;
  }>;

  const anchor = items.find((i) => i.role === "anchor");
  const challenger = items.find((i) => i.role === "challenger");
  if (!anchor || !challenger) return null;

  return {
    id: data.id,
    comparison_type: data.comparison_type as SuperlativePuzzle["comparison_type"],
    correct_answer: data.correct_answer,
    reveal_note: data.reveal_note ?? "",
    anchor_item: {
      name: anchor.name,
      tagline: anchor.tagline,
      value: Number(anchor.value),
      unit: anchor.unit,
      image_url: anchor.image_url ?? "",
    },
    challenger_item: {
      name: challenger.name,
      tagline: challenger.tagline,
      value: Number(challenger.value),
      unit: challenger.unit,
      image_url: challenger.image_url ?? "",
    },
  };
}

// ─── Fallback demo puzzles (used when no DB ids provided) ────────────────────

const DEMO_PUZZLES: SuperlativePuzzle[] = [
  {
    id: -1,
    comparison_type: "Heavier",
    anchor_item: {
      name: "Statue of Liberty",
      tagline: "Gift from France, somehow",
      value: 204117,
      unit: "kg",
      image_url: "https://images.pexels.com/photos/290386/pexels-photo-290386.jpeg?auto=compress&cs=tinysrgb&w=400",
    },
    challenger_item: {
      name: "Small Cumulus Cloud",
      tagline: "Looks harmless enough",
      value: 500000,
      unit: "kg",
      image_url: "https://images.pexels.com/photos/53594/blue-clouds-day-fluffy-53594.jpeg?auto=compress&cs=tinysrgb&w=400",
    },
    correct_answer: "Small Cumulus Cloud",
    reveal_note:
      "A typical cumulus cloud weighs ~500,000 kg — the water droplets are spread across a huge volume, but the mass adds up fast.",
  },
  {
    id: -2,
    comparison_type: "Longer",
    anchor_item: {
      name: "Hollywood Walk of Fame",
      tagline: "Noted tourist trap",
      value: 2400,
      unit: "m",
      image_url: "https://images.pexels.com/photos/1037987/pexels-photo-1037987.jpeg?auto=compress&cs=tinysrgb&w=400",
    },
    challenger_item: {
      name: "Coney Island Boardwalk",
      tagline: "Rides and hotdogs",
      value: 4000,
      unit: "m",
      image_url: "https://images.pexels.com/photos/1545590/pexels-photo-1545590.jpeg?auto=compress&cs=tinysrgb&w=400",
    },
    correct_answer: "Coney Island Boardwalk",
    reveal_note:
      "Coney Island's boardwalk stretches 4 km — almost double the 2.4 km Hollywood star-studded sidewalk.",
  },
  {
    id: -3,
    comparison_type: "Heavier",
    anchor_item: {
      name: "Blue Whale",
      tagline: "Biggest animal ever, allegedly",
      value: 150000,
      unit: "kg",
      image_url: "https://images.pexels.com/photos/2078240/pexels-photo-2078240.jpeg?auto=compress&cs=tinysrgb&w=400",
    },
    challenger_item: {
      name: "Eiffel Tower",
      tagline: "Paris's most famous eyesore",
      value: 7300000,
      unit: "kg",
      image_url: "https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=400",
    },
    correct_answer: "Eiffel Tower",
    reveal_note:
      "The Eiffel Tower is 7,300 tonnes of iron — about 48 blue whales. The heaviest animal alive isn't close.",
  },
];

// ─── Item Card Component ──────────────────────────────────────────────────────

interface ItemCardProps {
  item: SuperlativeItem;
  state: "idle" | "selected" | "correct" | "wrong" | "dimmed" | "timeout";
  onClick: () => void;
}

interface CardStyle {
  className: string;
  boxShadow: string;
}

const CARD_STYLES: Record<ItemCardProps["state"], CardStyle> = {
  idle:     { className: "border-cyan-400/30 bg-black/50 hover:border-cyan-400 hover:bg-cyan-500/10 active:scale-95", boxShadow: "0 0 10px rgba(0,255,255,0.15)" },
  selected: { className: "border-cyan-400 bg-cyan-500/20",                                                             boxShadow: "0 0 15px rgba(0,255,255,0.4)" },
  correct:  { className: "border-green-500 bg-green-500/20 animate-pulse",                                             boxShadow: "0 0 25px rgba(34,197,94,0.6)" },
  wrong:    { className: "border-red-500 bg-red-500/20",                                                               boxShadow: "0 0 20px rgba(239,68,68,0.5)" },
  dimmed:   { className: "border-cyan-400/10 bg-black/20 opacity-40",                                                  boxShadow: "none" },
  timeout:  { className: "border-red-500 bg-red-500/10 animate-pulse",                                                 boxShadow: "0 0 25px rgba(239,68,68,0.5)" },
};

function ItemCard({ item, state, onClick }: ItemCardProps) {
  const { className, boxShadow } = CARD_STYLES[state];
  const isDisabled = state === "correct" || state === "wrong" || state === "dimmed" || state === "timeout";

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`
        relative w-full rounded-xl border-2 p-4 text-left transition-all duration-200
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

      <div
        className="w-full h-28 rounded-lg mb-3 flex items-center justify-center border border-cyan-400/20 overflow-hidden bg-black"
        style={{ boxShadow: "inset 0 0 15px rgba(0,255,255,0.05)" }}
      >
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover rounded-lg"
        />
      </div>

      <p
        className="text-white font-semibold text-sm sm:text-base mb-1 leading-tight"
        style={{ textShadow: "0 0 8px rgba(255,255,255,0.3)" }}
      >
        {item.name}
      </p>

      <div className="h-4">
        {(state === "correct" || state === "wrong" || state === "dimmed") ? (
          <p
            className="text-yellow-400 font-bold text-xs"
            style={{ textShadow: "0 0 8px #fbbf24" }}
          >
            {formatValue(item.value, item.unit)}
          </p>
        ) : (
          <p className="text-cyan-400/50 text-xs italic truncate">
            {item.tagline ?? ""}
          </p>
        )}
      </div>
    </button>
  );
}


function formatValue(value: number, unit: string): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${unit}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k ${unit}`;
  return `${value} ${unit}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ROUND_DURATION_S = 60;

type RoundState = "loading" | "playing" | "revealing" | "timeout-pulsing" | "complete";

interface RoundResult {
  puzzleId: number;
  correct: boolean;
  score: number;
  chosenAnswer: string;
}

const Superlative = forwardRef<GameHandle, GameProps>(function Superlative({
  puzzleIds,
  puzzleId,
  onScoreUpdate,
  onComplete,
  timeRemaining,
}, ref) {
  const [puzzles, setPuzzles] = useState<SuperlativePuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>("loading");
  const [selectedItem, setSelectedItem] = useState<"anchor" | "challenger" | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_S);

  const scoreRef = useRef(0);
  const maxScoreRef = useRef(MAX_ROUND_SCORE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalScoreRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: scoreRef.current,
      maxScore: maxScoreRef.current,
    }),
    onGameEnd: () => {},
    pauseTimer: roundState === "revealing",
  }), [roundState]);

  // ── Internal 60-second timer ──────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (roundState !== "playing" && roundState !== "revealing") {
      stopTimer();
      return;
    }
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
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
    const t = setTimeout(() => {
      setRoundState("complete");
      onComplete?.(totalScoreRef.current, MAX_ROUND_SCORE, timeRemaining);
    }, 3000);
    return () => clearTimeout(t);
  }, [roundState, onComplete, timeRemaining]);

  // ── Load audio ───────────────────────────────────────────────────────────

  useEffect(() => {
    const loadAudio = async () => {
      await audioManager.loadSound('superlative-win', '/sounds/global/win_optimized.mp3', 2);
      await audioManager.loadSound('superlative-wrong', '/sounds/global/wrong_optimized.mp3', 2);
    };
    loadAudio();
  }, []);

  // ── Load puzzles ─────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setRoundState("loading");

      if (puzzleIds && puzzleIds.length > 0) {
        const loaded = await Promise.all(puzzleIds.map(loadPuzzleFromDB));
        const valid = loaded.filter(Boolean) as SuperlativePuzzle[];
        if (valid.length > 0) {
          setPuzzles(valid);
          setRoundState("playing");
          return;
        }
      }

      if (puzzleId) {
        const single = await loadPuzzleFromDB(puzzleId);
        if (single) {
          setPuzzles([single]);
          setRoundState("playing");
          return;
        }
      }

      setPuzzles(DEMO_PUZZLES);
      setRoundState("playing");
    };

    load();
  }, [puzzleIds, puzzleId]);

  // ── Current puzzle ────────────────────────────────────────────────────────

  const currentPuzzle = puzzles[currentIndex];

  // ── Handle answer ─────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (choice: "anchor" | "challenger") => {
      if (!currentPuzzle || roundState !== "playing") return;

      const chosenItem =
        choice === "anchor" ? currentPuzzle.anchor_item : currentPuzzle.challenger_item;
      const isCorrect = chosenItem.name === currentPuzzle.correct_answer;

      const score = calculateScore(isCorrect);

      if (isCorrect) {
        audioManager.play('superlative-win');
      } else {
        audioManager.play('superlative-wrong', 0.3);
      }

      setSelectedItem(choice);
      setRoundState("revealing");

      const newTotal = totalScore + score;
      setTotalScore(newTotal);
      scoreRef.current = newTotal;
      totalScoreRef.current = newTotal;
      setResults((prev) => [
        ...prev,
        { puzzleId: currentPuzzle.id, correct: isCorrect, score, chosenAnswer: chosenItem.name },
      ]);

      onScoreUpdate?.(newTotal, MAX_ROUND_SCORE);
    },
    [currentPuzzle, roundState, totalScore, onScoreUpdate]
  );

  // ── Advance to next puzzle ────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= puzzles.length) {
      stopTimer();
      setRoundState("complete");
      onComplete?.(totalScore, MAX_ROUND_SCORE, timeRemaining);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedItem(null);
      setRoundState("playing");
    }
  }, [currentIndex, puzzles.length, totalScore, timeRemaining, onComplete, stopTimer]);

  // ── Derived state for card display ────────────────────────────────────────

  const getCardState = (
    which: "anchor" | "challenger"
  ): "idle" | "selected" | "correct" | "wrong" | "dimmed" | "timeout" => {
    if (roundState === "timeout-pulsing") return "timeout";
    if (roundState === "playing") {
      return selectedItem === which ? "selected" : "idle";
    }
    if (roundState === "revealing") {
      const chosenItem =
        which === "anchor" ? currentPuzzle.anchor_item : currentPuzzle.challenger_item;
      const isChosen = selectedItem === which;
      const isCorrectItem = chosenItem.name === currentPuzzle?.correct_answer;

      if (isChosen && isCorrectItem) return "correct";
      if (isChosen && !isCorrectItem) return "wrong";
      if (!isChosen && isCorrectItem) return "correct";
      return "dimmed";
    }
    return "idle";
  };

  // ── Render: loading ───────────────────────────────────────────────────────

  if (roundState === "loading" || !currentPuzzle) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-3">
        <div className="text-center text-cyan-400">
          <div className="text-lg" style={{ textShadow: "0 0 10px #00ffff" }}>
            ⚡ Loading...
          </div>
          <div className="text-sm text-cyan-300 mt-2">Preparing comparisons</div>
        </div>
      </div>
    );
  }

  // ── Render: complete ──────────────────────────────────────────────────────

  if (roundState === "complete") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="min-h-screen bg-black flex items-start justify-center p-3 pt-6">
        <div className="text-center max-w-sm w-full text-white">
          <h2
            className="text-2xl font-bold text-cyan-400 mb-2"
            style={{ textShadow: "0 0 10px #00ffff" }}
          >
            🏆 Round Complete
          </h2>
          <p className="text-cyan-300 text-sm mb-6">
            {correct}/{puzzles.length} correct
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
              <span>{r.correct ? "✓" : "✗"} {puzzles[i]?.comparison_type}</span>
              <span className="font-bold">{r.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: playing / revealing ───────────────────────────────────────────

  const isRevealing = roundState === "revealing";
  const isTimedOut = roundState === "timeout-pulsing";
  const isDanger = secondsLeft <= 10 || isTimedOut;
  const timerProgress = (secondsLeft / ROUND_DURATION_S) * 100;

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-2 pt-0">
      <div className="max-w-sm w-full text-white">

        {/* Header */}
        <div className="mb-3 pt-2">

          {/* Game title */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px #22d3ee)" }}>
              <line x1="12" y1="3" x2="12" y2="21" />
              <line x1="5" y1="6" x2="19" y2="6" />
              <path d="M5 6 L2 12 Q5 15 8 12 L5 6" />
              <path d="M19 6 L22 12 Q19 15 16 12 L19 6" />
              <line x1="9" y1="21" x2="15" y2="21" />
            </svg>
            <h1
              className="text-2xl font-bold tracking-wide text-cyan-300"
              style={{ textShadow: "0 0 12px rgba(0,255,255,0.6)" }}
            >
              Superlative
            </h1>
          </div>
          <p className="text-center text-white/50 text-sm mb-2 tracking-wide">Which one ranks highest?</p>
          <div className="w-full h-px bg-cyan-400/30 mb-3" />

          {/* Score + puzzle counter row */}
          <div className="flex justify-between items-center mb-2">
            <div className="text-cyan-300 text-sm">
              Score:{" "}
              <strong className="text-yellow-400 tabular-nums text-base" style={{ textShadow: "0 0 8px #fbbf24" }}>
                {totalScore}
              </strong>
            </div>
            <span className="text-cyan-400/60 text-xs">
              {currentIndex + 1}/{puzzles.length}
            </span>
          </div>

          {/* Timer bar */}
          <div
            className="w-full h-1.5 bg-black rounded-lg border overflow-hidden mb-4"
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

          {/* Question prompt */}
          <div className="text-center mb-4">
            <p
              className="text-cyan-300 text-lg sm:text-xl font-medium tracking-wide mb-1"
              style={{ textShadow: "0 0 6px rgba(0,255,255,0.4)" }}
            >
              Which is
            </p>
            <p
              className="text-yellow-400 font-black leading-none"
              style={{
                fontSize: "clamp(3rem, 14vw, 5rem)",
                textShadow: "0 0 30px #fbbf24, 0 0 60px rgba(251,191,36,0.4)",
                letterSpacing: "-0.02em",
              }}
            >
              {currentPuzzle.comparison_type.toUpperCase()}?
            </p>
          </div>
        </div>

        {/* Item cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <ItemCard
            item={currentPuzzle.anchor_item}
            state={getCardState("anchor")}
            onClick={() => handleAnswer("anchor")}
          />
          <ItemCard
            item={currentPuzzle.challenger_item}
            state={getCardState("challenger")}
            onClick={() => handleAnswer("challenger")}
          />
        </div>

        {/* Info / reveal box — fixed height, no reflow */}
        <div
          className="rounded-xl border-2 bg-black/80 px-4 py-3 mb-4 transition-colors duration-300 overflow-hidden"
          style={{
            borderColor: isTimedOut ? "rgba(239,68,68,0.5)" : isRevealing ? "rgba(0,255,255,0.4)" : "rgba(0,255,255,0.12)",
            boxShadow: isTimedOut ? "0 0 20px rgba(239,68,68,0.3)" : isRevealing ? "0 0 20px rgba(0,255,255,0.2)" : "none",
            height: "5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isTimedOut ? (
            <p
              className="text-red-400 font-black text-center animate-pulse"
              style={{ fontSize: "clamp(1.4rem, 7vw, 2rem)", textShadow: "0 0 20px #f87171", letterSpacing: "-0.01em" }}
            >
              Time's Up!
            </p>
          ) : !isRevealing ? (
            <p
              className="w-full text-cyan-400/30 font-black text-center leading-none"
              style={{
                fontSize: "clamp(1.8rem, 9vw, 2.6rem)",
                letterSpacing: "-0.02em",
              }}
            >
              Guess
            </p>
          ) : (
            <p className="text-cyan-300 text-xs leading-relaxed line-clamp-3">
              {currentPuzzle.reveal_note}
            </p>
          )}
        </div>

        {/* Next button — always present */}
        <button
          onClick={isRevealing ? handleNext : undefined}
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
          {currentIndex + 1 >= puzzles.length ? "Finish Round" : "Next →"}
        </button>
      </div>
    </div>
  );
});

export default Superlative;
