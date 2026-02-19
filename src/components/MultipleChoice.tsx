import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabase";
import { GameHandle } from "../lib/gameTypes";
import { audioManager } from "../lib/audioManager";

// ─── Types ───────────────────────────────────────────────────────────────────

type OptionKey = "a" | "b" | "c";

interface MCPuzzle {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct_option: OptionKey;
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

// ─── Scoring ─────────────────────────────────────────────────────────────────

const PUZZLES_PER_ROUND = 3;
const MAX_SCORE_PER_PUZZLE = 250;
const MAX_ROUND_SCORE = MAX_SCORE_PER_PUZZLE * PUZZLES_PER_ROUND;
const ROUND_DURATION_S = 60;

// ─── Demo fallback ────────────────────────────────────────────────────────────

const DEMO_PUZZLES: MCPuzzle[] = [
  {
    id: -1,
    question: "Which planet in our solar system has the most moons?",
    option_a: "Jupiter",
    option_b: "Saturn",
    option_c: "Uranus",
    correct_option: "b",
    explanation: "Saturn leads with 146 confirmed moons as of 2024, edging out Jupiter's 95.",
  },
  {
    id: -2,
    question: "What is the only country that borders both the Atlantic and Indian Oceans?",
    option_a: "Australia",
    option_b: "South Africa",
    option_c: "Brazil",
    correct_option: "b",
    explanation: "South Africa sits at the tip of the African continent where the two great oceans meet near Cape Agulhas.",
  },
  {
    id: -3,
    question: "Which element makes up about 78% of Earth's atmosphere?",
    option_a: "Oxygen",
    option_b: "Carbon Dioxide",
    option_c: "Nitrogen",
    correct_option: "c",
    explanation: "Nitrogen (N₂) makes up roughly 78% of air. Oxygen is about 21%, all other gases combine for less than 1%.",
  },
];

// ─── DB Loaders ───────────────────────────────────────────────────────────────

async function loadPuzzleFromDB(id: number): Promise<MCPuzzle | null> {
  const { data, error } = await supabase
    .from("multiple_choice_puzzles")
    .select("id, question, option_a, option_b, option_c, correct_option, explanation")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as MCPuzzle;
}

async function loadRandomPuzzles(count: number): Promise<MCPuzzle[]> {
  const { data, error } = await supabase
    .from("multiple_choice_puzzles")
    .select("id, question, option_a, option_b, option_c, correct_option, explanation")
    .eq("is_active", true);

  if (error || !data || data.length === 0) return DEMO_PUZZLES;

  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count) as MCPuzzle[];
}

// ─── Answer Button Component ──────────────────────────────────────────────────

type AnswerState = "idle" | "correct" | "wrong" | "dimmed" | "timeout";

interface AnswerButtonProps {
  optionKey: OptionKey;
  label: string;
  state: AnswerState;
  onClick: () => void;
}

const OPTION_LABELS: Record<OptionKey, string> = { a: "A", b: "B", c: "C" };

const OPTION_COLORS: Record<OptionKey, { base: string; dim: string; glow: string; idleBorder: string; idleGlow: string }> = {
  a: {
    base: "#22d3ee",
    dim: "rgba(34,211,238,0.12)",
    glow: "rgba(34,211,238,0.6)",
    idleBorder: "rgba(34,211,238,0.3)",
    idleGlow: "rgba(34,211,238,0.08)",
  },
  b: {
    base: "#f59e0b",
    dim: "rgba(245,158,11,0.12)",
    glow: "rgba(245,158,11,0.6)",
    idleBorder: "rgba(245,158,11,0.3)",
    idleGlow: "rgba(245,158,11,0.08)",
  },
  c: {
    base: "#ec4899",
    dim: "rgba(236,72,153,0.12)",
    glow: "rgba(236,72,153,0.6)",
    idleBorder: "rgba(236,72,153,0.3)",
    idleGlow: "rgba(236,72,153,0.08)",
  },
};

function AnswerButton({ optionKey, label, state, onClick }: AnswerButtonProps) {
  const col = OPTION_COLORS[optionKey];
  const letter = OPTION_LABELS[optionKey];
  const isDisabled = state !== "idle";

  const stateStyles: Record<AnswerState, React.CSSProperties> = {
    idle: {
      border: `2px solid ${col.idleBorder}`,
      background: "rgba(0,0,0,0.5)",
      boxShadow: `0 0 10px ${col.idleGlow}`,
      opacity: 1,
    },
    correct: {
      border: `2px solid ${col.base}`,
      background: col.dim,
      boxShadow: `0 0 25px ${col.glow}`,
      opacity: 1,
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
      opacity: 0.3,
    },
    timeout: {
      border: "2px solid rgba(239,68,68,0.4)",
      background: "rgba(239,68,68,0.07)",
      boxShadow: "0 0 15px rgba(239,68,68,0.25)",
      opacity: 0.6,
    },
  };

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className="relative w-full rounded-xl transition-all duration-300 flex items-center gap-3 px-4 touch-manipulation"
      style={{
        ...stateStyles[state],
        height: "clamp(58px, 14vw, 76px)",
        cursor: isDisabled ? "default" : "pointer",
      }}
    >
      {/* Option letter badge */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300"
        style={
          state === "correct"
            ? { background: col.base, color: "#000", boxShadow: `0 0 12px ${col.glow}` }
            : state === "wrong"
            ? { background: "rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.4)" }
            : state === "dimmed"
            ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.08)" }
            : { background: `${col.dim}`, color: col.base, border: `1px solid ${col.idleBorder}` }
        }
      >
        {letter}
      </div>

      {/* Answer text */}
      <span
        className="text-left font-semibold leading-tight flex-1 transition-all duration-300"
        style={{
          fontSize: "clamp(0.78rem, 3.2vw, 0.95rem)",
          color:
            state === "correct"
              ? col.base
              : state === "wrong"
              ? "rgba(239,68,68,0.8)"
              : state === "dimmed"
              ? "rgba(255,255,255,0.25)"
              : "rgba(255,255,255,0.9)",
          textShadow: state === "correct" ? `0 0 12px ${col.glow}` : "none",
        }}
      >
        {label}
      </span>

      {/* Result icon */}
      {state === "correct" && (
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-black"
          style={{ background: col.base, boxShadow: `0 0 10px ${col.glow}` }}
        >
          ✓
        </div>
      )}
      {state === "wrong" && (
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-black bg-red-500"
          style={{ boxShadow: "0 0 10px rgba(239,68,68,0.8)" }}
        >
          ✗
        </div>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type RoundState = "loading" | "playing" | "revealing" | "timeout-pulsing" | "complete";

interface RoundResult {
  puzzleId: number;
  correct: boolean;
  score: number;
}

const MultipleChoice = forwardRef<GameHandle, GameProps>(function MultipleChoice(
  { puzzleIds, puzzleId, onScoreUpdate, onComplete, timeRemaining },
  ref
) {
  const [puzzles, setPuzzles] = useState<MCPuzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>("loading");
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
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
  }), []);

  // ── Timer ─────────────────────────────────────────────────────────────────

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

  // ── Audio ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      await audioManager.loadSound("mc-win", "/sounds/global/win_optimized.mp3", 2);
      await audioManager.loadSound("mc-wrong", "/sounds/global/wrong_optimized.mp3", 2);
    };
    load();
  }, []);

  // ── Load puzzles ──────────────────────────────────────────────────────────

  const puzzleIdsKey = JSON.stringify(puzzleIds);

  useEffect(() => {
    const load = async () => {
      setRoundState("loading");
      try {
        let loaded: MCPuzzle[] = [];

        if (puzzleIds && puzzleIds.length > 0) {
          const fetched = await Promise.all(puzzleIds.map(loadPuzzleFromDB));
          loaded = fetched.filter(Boolean) as MCPuzzle[];
        } else if (puzzleId) {
          const single = await loadPuzzleFromDB(puzzleId);
          if (single) loaded = [single];
        }

        if (loaded.length === 0) {
          loaded = await loadRandomPuzzles(PUZZLES_PER_ROUND);
        }

        setPuzzles(loaded.length > 0 ? loaded : DEMO_PUZZLES);
        setRoundState("playing");
      } catch {
        setPuzzles(DEMO_PUZZLES);
        setRoundState("playing");
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleIdsKey, puzzleId]);

  const currentPuzzle = puzzles[currentIndex];

  // ── Handle answer ─────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (choice: OptionKey) => {
      if (!currentPuzzle || roundState !== "playing") return;

      const isCorrect = choice === currentPuzzle.correct_option;
      const score = isCorrect ? MAX_SCORE_PER_PUZZLE : 0;

      if (isCorrect) {
        audioManager.play("mc-win");
      } else {
        audioManager.play("mc-wrong", 0.3);
      }

      setSelectedOption(choice);
      setRoundState("revealing");

      const newTotal = totalScore + score;
      setTotalScore(newTotal);
      scoreRef.current = newTotal;
      totalScoreRef.current = newTotal;
      setResults((prev) => [...prev, { puzzleId: currentPuzzle.id, correct: isCorrect, score }]);

      onScoreUpdate?.(newTotal, MAX_ROUND_SCORE);
    },
    [currentPuzzle, roundState, totalScore, onScoreUpdate]
  );

  // ── Advance ───────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= puzzles.length) {
      stopTimer();
      setRoundState("complete");
      onComplete?.(totalScore, MAX_ROUND_SCORE, timeRemaining);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setRoundState("playing");
    }
  }, [currentIndex, puzzles.length, totalScore, timeRemaining, onComplete, stopTimer]);

  // ── Card states ───────────────────────────────────────────────────────────

  const getOptionState = (key: OptionKey): AnswerState => {
    if (roundState === "timeout-pulsing") return "timeout";
    if (roundState === "playing") return "idle";
    if (roundState === "revealing") {
      const isChosen = selectedOption === key;
      const isCorrect = key === currentPuzzle?.correct_option;
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
  const timerWarning = secondsLeft <= 10;
  const timerProgress = (secondsLeft / ROUND_DURATION_S) * 100;
  const options: { key: OptionKey; label: string }[] = [
    { key: "a", label: currentPuzzle.option_a },
    { key: "b", label: currentPuzzle.option_b },
    { key: "c", label: currentPuzzle.option_c },
  ];

  return (
    <div className="h-full bg-black overflow-y-auto flex items-start justify-center p-2 pt-0 pb-4">
      <div className="max-w-sm w-full text-white pb-4">

        {/* Header */}
        <div className="mb-3 pt-2">

          {/* Title */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px #22d3ee)" }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h1
              className="text-2xl font-bold tracking-wide text-cyan-300"
              style={{ textShadow: "0 0 12px rgba(0,255,255,0.6)" }}
            >
              Multiple Choice
            </h1>
          </div>
          <p className="text-center text-white/50 text-sm mb-2 tracking-wide">Pick the correct answer</p>
          <div className="w-full h-px bg-cyan-400/30 mb-3" />

          {/* Score + timer row */}
          <div className="flex justify-between items-center mb-2">
            <div className="text-cyan-300 text-sm">
              Score:{" "}
              <strong className="text-yellow-400 tabular-nums text-base" style={{ textShadow: "0 0 8px #fbbf24" }}>
                {totalScore}
              </strong>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`tabular-nums font-bold text-sm ${timerWarning || isTimedOut ? "text-red-400" : "text-cyan-400/80"}`}
                style={timerWarning || isTimedOut ? { textShadow: "0 0 8px #f87171" } : undefined}
              >
                {secondsLeft}s
              </span>
              <span className="text-cyan-400/60 text-xs">
                {currentIndex + 1}/{puzzles.length}
              </span>
            </div>
          </div>

          {/* Timer bar */}
          <div
            className="w-full h-1.5 bg-black rounded-lg border overflow-hidden mb-4"
            style={{
              borderColor: timerWarning || isTimedOut ? "rgba(239,68,68,0.5)" : "rgba(0,255,255,0.5)",
              boxShadow: timerWarning || isTimedOut ? "0 0 6px rgba(239,68,68,0.2)" : "0 0 6px rgba(0,255,255,0.2)",
            }}
          >
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{
                width: `${timerProgress}%`,
                background: timerWarning || isTimedOut ? "#f87171" : "#22d3ee",
                boxShadow: timerWarning || isTimedOut ? "0 0 8px #f87171" : "0 0 8px #00ffff",
              }}
            />
          </div>

          {/* Question */}
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
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {currentPuzzle.question}
            </p>
          </div>
        </div>

        {/* Answer tiles */}
        <div className="flex flex-col gap-2.5 mb-4">
          {options.map(({ key, label }) => (
            <AnswerButton
              key={key}
              optionKey={key}
              label={label}
              state={getOptionState(key)}
              onClick={() => handleAnswer(key)}
            />
          ))}
        </div>

        {/* Explanation / reveal box */}
        <div
          className="rounded-xl border-2 bg-black/80 px-4 py-3 mb-4 transition-colors duration-300"
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
              style={{ fontSize: "clamp(1.4rem, 7vw, 2rem)", textShadow: "0 0 20px #f87171", letterSpacing: "-0.01em" }}
            >
              Time's Up!
            </p>
          ) : !isRevealing ? (
            <p
              className="w-full text-cyan-400/30 font-black text-center leading-none"
              style={{
                fontSize: "clamp(1.4rem, 7vw, 2rem)",
                letterSpacing: "-0.02em",
              }}
            >
              A &nbsp; B &nbsp; C
            </p>
          ) : (
            <p className="text-cyan-300 text-xs leading-relaxed">
              {currentPuzzle.explanation}
            </p>
          )}
        </div>

        {/* Next button */}
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

export default MultipleChoice;
