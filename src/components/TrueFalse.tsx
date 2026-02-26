import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabase";
import { GameHandle } from "../lib/gameTypes";
import { useQuizRound } from "../lib/useQuizRound";
import { playSelect } from "../lib/sounds";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrueFalsePuzzle {
  id: number;
  statement: string;
  correct_answer: boolean;
  explanation: string;
}

interface GameProps {
  puzzleIds?: number[] | null;
  puzzleId?: number | null;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

// ─── Demo fallback ────────────────────────────────────────────────────────────

const DEMO_PUZZLES: TrueFalsePuzzle[] = [
  {
    id: -1,
    statement: "Honey never spoils. Edible honey has been found in Egyptian tombs over 3,000 years old.",
    correct_answer: true,
    explanation: "Honey's low moisture content and acidic pH make it inhospitable for bacteria. Archaeologists have indeed eaten 3,000-year-old honey from ancient Egyptian tombs.",
  },
  {
    id: -2,
    statement: "The Great Wall of China is visible from space with the naked eye.",
    correct_answer: false,
    explanation: "One of history's most persistent myths. The wall is only 15–30 feet wide — far too narrow to see from orbit. Chinese astronaut Yang Liwei confirmed he could not see it.",
  },
  {
    id: -3,
    statement: "A day on Venus is longer than a year on Venus.",
    correct_answer: true,
    explanation: "Venus rotates so slowly that one day (243 Earth days) is longer than its year — the time to orbit the Sun (225 Earth days).",
  },
];

// ─── DB Loaders ───────────────────────────────────────────────────────────────

async function loadPuzzleFromDB(id: number): Promise<TrueFalsePuzzle | null> {
  const { data, error } = await supabase
    .from("true_false_puzzles")
    .select("id, statement, correct_answer, explanation")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as TrueFalsePuzzle;
}

async function loadRandomPuzzles(count: number): Promise<TrueFalsePuzzle[]> {
  const { data, error } = await supabase
    .from("true_false_puzzles")
    .select("id, statement, correct_answer, explanation")
    .eq("is_active", true);

  if (error || !data || data.length === 0) return DEMO_PUZZLES;

  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count) as TrueFalsePuzzle[];
}

// ─── Answer Button Component ──────────────────────────────────────────────────

type AnswerState = "idle" | "correct" | "wrong" | "dimmed" | "timeout";

interface AnswerButtonProps {
  value: boolean;
  state: AnswerState;
  onClick: () => void;
}

function AnswerButton({ value, state, onClick }: AnswerButtonProps) {
  const isTrue = value;
  const shakeClass = state === "wrong" ? "animate-shake" : "";

  const baseColor = isTrue
    ? { base: "#22c55e", dim: "rgba(34,197,94,0.15)", glow: "rgba(34,197,94,0.6)" }
    : { base: "#ef4444", dim: "rgba(239,68,68,0.15)", glow: "rgba(239,68,68,0.6)" };

  const stateStyles: Record<AnswerState, React.CSSProperties> = {
    idle: {
      border: `2px solid ${isTrue ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
      background: "rgba(0,0,0,0.5)",
      boxShadow: `0 0 10px ${isTrue ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}`,
    },
    correct: {
      border: `2px solid ${baseColor.base}`,
      background: baseColor.dim,
      boxShadow: `0 0 25px ${baseColor.glow}`,
    },
    wrong: {
      border: "2px solid rgba(239,68,68,0.6)",
      background: "rgba(239,68,68,0.1)",
      boxShadow: "0 0 20px rgba(239,68,68,0.4)",
      opacity: 0.45,
    },
    dimmed: {
      border: "2px solid rgba(255,255,255,0.06)",
      background: "rgba(0,0,0,0.2)",
      opacity: 0.35,
    },
    timeout: {
      border: "2px solid rgba(239,68,68,0.5)",
      background: "rgba(239,68,68,0.08)",
      boxShadow: "0 0 20px rgba(239,68,68,0.3)",
    },
  };

  const textColor = isTrue ? "#22c55e" : "#ef4444";
  const textShadow = isTrue
    ? "0 0 30px rgba(34,197,94,0.8), 0 0 60px rgba(34,197,94,0.4)"
    : "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.4)";

  const isDisabled = state !== "idle";

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`relative w-full rounded-xl transition-all duration-300 flex items-center justify-center touch-manipulation ${shakeClass}`}
      style={{
        ...stateStyles[state],
        height: "clamp(100px, 22vw, 140px)",
        cursor: isDisabled ? "default" : "pointer",
      }}
    >
      {state === "correct" && (
        <div
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm text-black animate-pop-in"
          style={{ background: baseColor.base, boxShadow: `0 0 12px ${baseColor.glow}` }}
        >
          ✓
        </div>
      )}
      {state === "wrong" && (
        <div
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm text-black bg-red-500 animate-pop-in"
          style={{ boxShadow: "0 0 12px rgba(239,68,68,0.8)" }}
        >
          ✗
        </div>
      )}
      <span
        className="font-black select-none"
        style={{
          fontSize: "clamp(2.8rem, 12vw, 4.5rem)",
          color: textColor,
          textShadow,
          letterSpacing: "-0.02em",
        }}
      >
        {isTrue ? "True" : "False"}
      </span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TrueFalse = forwardRef<GameHandle, GameProps>(function TrueFalse({
  puzzleIds,
  puzzleId,
  onScoreUpdate,
  onComplete,
  timeRemaining,
}, ref) {
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);

  const {
    puzzles,
    currentPuzzle,
    currentIndex,
    roundState,
    results,
    totalScore,
    isDanger,
    timerProgress,
    isLastPuzzle,
    recordAnswer,
    handleNext,
    getGameScore,
  } = useQuizRound<TrueFalsePuzzle>({
    puzzleIds,
    puzzleId,
    loadById: loadPuzzleFromDB,
    loadRandom: loadRandomPuzzles,
    demoPuzzles: DEMO_PUZZLES,
    getPuzzleId: (p) => p.id,
    audioWinKey: "tf-win",
    audioWrongKey: "tf-wrong",
    onScoreUpdate,
    onComplete,
    timeRemaining,
  });

  useImperativeHandle(ref, () => ({
    getGameScore,
    onGameEnd: () => {},
    pauseTimer: roundState === "revealing",
    hideTimer: true,
  }), [getGameScore, roundState]);

  const handleAnswer = useCallback(
    (choice: boolean) => {
      if (!currentPuzzle || roundState !== "playing") return;
      playSelect();
      setSelectedAnswer(choice);
      recordAnswer(choice === currentPuzzle.correct_answer);
    },
    [currentPuzzle, roundState, recordAnswer]
  );

  const onNext = useCallback(() => {
    handleNext(() => setSelectedAnswer(null));
  }, [handleNext]);

  const getAnswerState = (value: boolean): AnswerState => {
    if (roundState === "timeout-pulsing") return "timeout";
    if (roundState === "playing") return "idle";
    if (roundState === "revealing") {
      const isChosen = selectedAnswer === value;
      const isCorrect = value === currentPuzzle?.correct_answer;
      if (isChosen && isCorrect) return "correct";
      if (isChosen && !isCorrect) return "wrong";
      if (!isChosen && isCorrect) return "correct";
      return "dimmed";
    }
    return "idle";
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (roundState === "loading" || !currentPuzzle) {
    return (
      <div className="h-full bg-black flex items-center justify-center p-3">
        <div className="text-center text-cyan-400">
          <div className="text-lg" style={{ textShadow: "0 0 10px #00ffff" }}>
            Loading...
          </div>
          <div className="text-sm text-cyan-300 mt-2">Preparing questions</div>
        </div>
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  if (roundState === "complete") {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="h-full bg-black overflow-y-auto flex items-start justify-center p-3 pt-6">
        <div className="text-center max-w-sm w-full text-white">
          <h2
            className="text-2xl font-bold text-cyan-400 mb-2"
            style={{ textShadow: "0 0 10px #00ffff" }}
          >
            Round Complete
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
              <span>{r.correct ? "✓" : "✗"} Q{i + 1}</span>
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
    <div className="h-full bg-black overflow-y-auto flex items-start justify-center p-2 pt-0">
      <div className="max-w-sm w-full text-white">

        {/* Header - icon + name left, score right (matches OddManOut/FakeOut/Superlative) */}
        <div className="flex items-center justify-between mb-3 pt-2">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px #22d3ee)" }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <h2 className="text-xs sm:text-sm font-bold text-cyan-400" style={{ textShadow: '0 0 10px #00ffff' }}>True or False</h2>
          </div>
          <div className="text-cyan-300 text-xs sm:text-sm">
            Score: <strong className="text-yellow-400 tabular-nums">{totalScore.toLocaleString()}</strong>
          </div>
        </div>

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

        {/* Statement */}
        <div
          className="rounded-xl border-2 px-4 py-4 mb-4"
          style={{
            borderColor: "rgba(0,255,255,0.25)",
            background: "rgba(0,255,255,0.04)",
            boxShadow: "0 0 15px rgba(0,255,255,0.08)",
            minHeight: "5.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            className="text-white font-medium text-center leading-snug"
            style={{
              fontSize: "clamp(0.85rem, 3.5vw, 1.05rem)",
              textShadow: "0 0 6px rgba(255,255,255,0.15)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {currentPuzzle.statement}
          </p>
        </div>

        {/* Answer buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <AnswerButton value={true} state={getAnswerState(true)} onClick={() => handleAnswer(true)} />
          <AnswerButton value={false} state={getAnswerState(false)} onClick={() => handleAnswer(false)} />
        </div>

        {/* Explanation / reveal box */}
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
              True or False?
            </p>
          ) : (
            <p className="text-cyan-300 text-xs leading-relaxed line-clamp-3 animate-fade-in-up">
              {currentPuzzle.explanation}
            </p>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={isRevealing ? onNext : undefined}
          disabled={!isRevealing}
          className="w-full py-3 bg-transparent border-2 rounded-xl text-sm font-bold transition-all touch-manipulation active:scale-95"
          style={{
            borderColor: isRevealing ? "#ec4899" : "rgba(236,72,153,0.2)",
            color: isRevealing ? "#f472b6" : "rgba(244,114,182,0.2)",
            textShadow: isRevealing ? "0 0 8px #ec4899" : "none",
            boxShadow: isRevealing ? "0 0 15px rgba(236,72,153,0.3)" : "none",
            cursor: isRevealing ? "pointer" : "default",
          }}
        >
          {isLastPuzzle ? "Finish Round" : "Next →"}
        </button>
      </div>
    </div>
  );
});

export default TrueFalse;