import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { GameHandle } from "../lib/gameTypes";

interface GameProps {
  puzzleIds?: number[] | null;
  puzzleId?: number | null;
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number, timeRemaining?: number) => void;
  timeRemaining?: number;
  duration?: number;
}

interface RoundConfig {
  cols: number;
  rows: number;
  litCount: number;
  flashMs: number;
}

const ROUND_CONFIGS: RoundConfig[] = [
  { cols: 3, rows: 3, litCount: 3, flashMs: 1200 },
  { cols: 3, rows: 3, litCount: 4, flashMs: 1000 },
  { cols: 4, rows: 4, litCount: 5, flashMs: 900 },
  { cols: 4, rows: 4, litCount: 7, flashMs: 750 },
  { cols: 4, rows: 4, litCount: 9, flashMs: 600 },
];

const TOTAL_ROUNDS = ROUND_CONFIGS.length;
const MAX_RAW = 125;
const MAX_SCORE = 1000;

type Phase = "get-ready" | "flash" | "recall" | "reveal" | "game-over";

function pickLitIndices(total: number, count: number): Set<number> {
  const indices = new Set<number>();
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * total));
  }
  return indices;
}

const Flashbang = forwardRef<GameHandle, GameProps>(({ onScoreUpdate, onComplete }, ref) => {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("get-ready");
  const [litIndices, setLitIndices] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [totalScore, setTotalScore] = useState(0);
  const [roundScore, setRoundScore] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const scoreRef = useRef(0);
  const roundRef = useRef(0);
  const phaseRef = useRef<Phase>("get-ready");
  const litRef = useRef<Set<number>>(new Set());
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: MAX_SCORE }),
    onGameEnd: () => {
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    },
    pauseTimer: false,
  }));

  const config = ROUND_CONFIGS[round] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
  const tileCount = config.cols * config.rows;

  const startRound = useCallback((roundIndex: number) => {
    const cfg = ROUND_CONFIGS[roundIndex] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    const total = cfg.cols * cfg.rows;
    const lit = pickLitIndices(total, cfg.litCount);

    litRef.current = lit;
    setLitIndices(new Set(lit));
    setSelected(new Set());
    setRoundScore(null);
    phaseRef.current = "flash";
    setPhase("flash");

    flashTimerRef.current = setTimeout(() => {
      phaseRef.current = "recall";
      setPhase("recall");
    }, cfg.flashMs);
  }, []);

  const submitAnswer = useCallback((currentSelected: Set<number>) => {
    if (phaseRef.current !== "recall") return;
    phaseRef.current = "reveal";
    setPhase("reveal");

    const lit = litRef.current;
    const cfg = ROUND_CONFIGS[roundRef.current] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    const pointsPerTile = 100 / cfg.litCount;

    let raw = 0;
    let wrongTaps = 0;

    currentSelected.forEach((idx) => {
      if (lit.has(idx)) {
        raw += pointsPerTile;
      } else {
        wrongTaps++;
      }
    });

    raw -= wrongTaps * 20;
    raw = Math.max(0, raw);

    const isPerfect = currentSelected.size === lit.size &&
      [...currentSelected].every((i) => lit.has(i));
    if (isPerfect) raw += 25;

    raw = Math.round(Math.min(raw, MAX_RAW));
    setRoundScore(raw);

    const normalized = Math.round((raw / MAX_RAW) * (MAX_SCORE / TOTAL_ROUNDS));
    const newTotal = scoreRef.current + normalized;
    scoreRef.current = newTotal;
    setTotalScore(newTotal);
    onScoreUpdate?.(newTotal, MAX_SCORE);

    revealTimerRef.current = setTimeout(() => {
      const nextRound = roundRef.current + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        phaseRef.current = "game-over";
        setPhase("game-over");
        setGameOver(true);
        onComplete?.(scoreRef.current, MAX_SCORE, 0);
        return;
      }
      roundRef.current = nextRound;
      setRound(nextRound);
      phaseRef.current = "get-ready";
      setPhase("get-ready");

      readyTimerRef.current = setTimeout(() => {
        startRound(nextRound);
      }, 900);
    }, 1400);
  }, [onScoreUpdate, onComplete, startRound]);

  const handleTileClick = useCallback((idx: number) => {
    if (phaseRef.current !== "recall") return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    readyTimerRef.current = setTimeout(() => {
      startRound(0);
    }, 1000);

    return () => {
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [startRound]);

  useEffect(() => {
    if (phase !== "recall") return;
    const cfg = ROUND_CONFIGS[round] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    if (selected.size === cfg.litCount) {
      submitAnswer(selected);
    }
  }, [selected, phase, round, submitAnswer]);

  const getTileStyle = (idx: number): React.CSSProperties => {
    if (phase === "flash" && litIndices.has(idx)) {
      return {
        background: "#22d3ee",
        borderColor: "#22d3ee",
        boxShadow: "0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.4)",
      };
    }
    if (phase === "recall" && selected.has(idx)) {
      return {
        background: "rgba(6,182,212,0.2)",
        borderColor: "#22d3ee",
        boxShadow: "0 0 8px rgba(0,255,255,0.3)",
      };
    }
    if (phase === "reveal") {
      const isLit = litIndices.has(idx);
      const isSel = selected.has(idx);
      if (isLit && isSel) {
        return {
          background: "rgba(34,197,94,0.2)",
          borderColor: "#22c55e",
          boxShadow: "0 0 16px rgba(34,197,94,0.5)",
        };
      }
      if (!isLit && isSel) {
        return {
          background: "rgba(239,68,68,0.2)",
          borderColor: "#ef4444",
          boxShadow: "0 0 16px rgba(239,68,68,0.5)",
        };
      }
      if (isLit && !isSel) {
        return {
          background: "rgba(0,255,255,0.08)",
          borderColor: "rgba(0,255,255,0.6)",
          boxShadow: "0 0 12px rgba(0,255,255,0.3)",
          animation: "pulse 0.4s ease-out",
        };
      }
    }
    return {};
  };

  const getTileClass = (idx: number): string => {
    const base = "rounded-lg border-2 transition-all duration-150 active:scale-95 select-none cursor-pointer";
    const isFlashLit = phase === "flash" && litIndices.has(idx);
    const isSelected = phase === "recall" && selected.has(idx);
    const isReveal = phase === "reveal";
    const isLit = litIndices.has(idx);
    const isSel = selected.has(idx);

    if (isFlashLit) return `${base} border-cyan-400`;
    if (isSelected) return `${base} border-cyan-400`;
    if (isReveal && isLit && isSel) return `${base} border-green-500`;
    if (isReveal && !isLit && isSel) return `${base} border-red-500`;
    if (isReveal && isLit && !isSel) return `${base} border-cyan-400/60`;
    if (phase !== "recall") return `${base} border-cyan-400/30 bg-black cursor-default`;
    return `${base} border-cyan-400/30 bg-black`;
  };

  const tileSize = config.cols === 3 ? 88 : 64;
  const gap = config.cols === 3 ? 10 : 8;
  const gridWidth = config.cols * tileSize + (config.cols - 1) * gap;
  const gridHeight = config.rows * tileSize + (config.rows - 1) * gap;

  if (gameOver) {
    return (
      <div className="h-full bg-black flex items-center justify-center p-4">
        <div className="max-w-xs w-full text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-3xl" style={{ filter: "drop-shadow(0 0 8px #00ffff)" }}>⚡</span>
            <h1
              className="text-3xl font-black tracking-wider text-cyan-300"
              style={{ textShadow: "0 0 20px rgba(0,255,255,0.8)" }}
            >
              Flashbang
            </h1>
          </div>
          <div
            className="border border-cyan-400/30 rounded-2xl p-6 mb-4"
            style={{ background: "rgba(0,255,255,0.04)", boxShadow: "0 0 30px rgba(0,255,255,0.08)" }}
          >
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Final Score</p>
            <p className="text-6xl font-black text-yellow-400" style={{ textShadow: "0 0 30px #fbbf24" }}>
              {scoreRef.current}
            </p>
            <p className="text-white/30 text-sm mt-2">out of {MAX_SCORE}</p>
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = phase === "recall" && selected.size > 0;
  const showSubmit = phase === "recall" && selected.size < config.litCount;

  return (
    <div className="relative h-full bg-black flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 flex-shrink-0">
        <div className="flex flex-col items-start min-w-[60px]">
          <span className="text-white/40 text-xs uppercase tracking-widest leading-none mb-0.5">Score</span>
          <span
            className="text-yellow-400 text-2xl font-black leading-none"
            style={{ textShadow: "0 0 12px #fbbf24" }}
          >
            {totalScore}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-lg" style={{ filter: "drop-shadow(0 0 6px #00ffff)" }}>⚡</span>
          <h1
            className="text-xl font-bold tracking-wide text-cyan-300"
            style={{ textShadow: "0 0 10px rgba(0,255,255,0.6)" }}
          >
            Flashbang
          </h1>
        </div>

        <span className="text-white/40 text-xs tracking-wider uppercase min-w-[60px] text-right">
          {round + 1}/{TOTAL_ROUNDS}
        </span>
      </div>

      {/* Progress pips */}
      <div className="flex gap-1.5 px-4 pb-2 flex-shrink-0">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: i < round ? "#22c55e" : i === round ? "#00ffff" : "rgba(255,255,255,0.15)",
              boxShadow: i === round ? "0 0 6px #00ffff" : "none",
            }}
          />
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-4">
        {/* Phase label */}
        <div className="h-8 flex items-center justify-center">
          {phase === "get-ready" && (
            <p
              className="text-xl font-black tracking-widest uppercase text-cyan-300"
              style={{ textShadow: "0 0 16px rgba(0,255,255,0.8)" }}
            >
              Get Ready…
            </p>
          )}
          {phase === "flash" && (
            <p
              className="text-lg font-bold tracking-widest uppercase text-cyan-400"
              style={{ textShadow: "0 0 12px rgba(0,255,255,0.6)" }}
            >
              Memorize!
            </p>
          )}
          {phase === "recall" && (
            <p className="text-lg font-bold tracking-widest uppercase text-white/60">
              Which tiles were lit?
            </p>
          )}
          {phase === "reveal" && roundScore !== null && (
            <div className="flex items-center gap-3">
              <p
                className="text-2xl font-black tracking-widest uppercase"
                style={{
                  color: roundScore >= MAX_RAW * 0.8 ? "#22c55e" : roundScore > 0 ? "#fbbf24" : "#ef4444",
                  textShadow: roundScore >= MAX_RAW * 0.8
                    ? "0 0 20px rgba(34,197,94,0.8)"
                    : roundScore > 0
                    ? "0 0 20px rgba(251,191,36,0.8)"
                    : "0 0 20px rgba(239,68,68,0.8)",
                }}
              >
                {roundScore === MAX_RAW ? "Perfect!" : roundScore > 0 ? "Nice!" : "Miss!"}
              </p>
              <p className="text-white/50 text-lg font-bold">+{Math.round((roundScore / MAX_RAW) * (MAX_SCORE / TOTAL_ROUNDS))}</p>
            </div>
          )}
        </div>

        {/* Fixed-size grid container — no layout shift between phases */}
        <div
          style={{
            width: gridWidth,
            height: gridHeight,
            display: "grid",
            gridTemplateColumns: `repeat(${config.cols}, ${tileSize}px)`,
            gridTemplateRows: `repeat(${config.rows}, ${tileSize}px)`,
            gap: `${gap}px`,
          }}
        >
          {Array.from({ length: tileCount }).map((_, idx) => (
            <div
              key={`${round}-${idx}`}
              className={getTileClass(idx)}
              style={{
                width: tileSize,
                height: tileSize,
                ...getTileStyle(idx),
              }}
              onPointerDown={() => handleTileClick(idx)}
            />
          ))}
        </div>

        {/* Submit button — only shown in recall if not enough selected yet for auto-submit */}
        <div className="h-12 flex items-center justify-center">
          {showSubmit && (
            <button
              className="px-8 py-2.5 rounded-xl font-bold tracking-wider uppercase text-sm transition-all duration-150 active:scale-95"
              style={{
                background: canSubmit ? "rgba(0,255,255,0.12)" : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${canSubmit ? "#22d3ee" : "rgba(255,255,255,0.15)"}`,
                color: canSubmit ? "#22d3ee" : "rgba(255,255,255,0.3)",
                boxShadow: canSubmit ? "0 0 16px rgba(0,255,255,0.2)" : "none",
                cursor: canSubmit ? "pointer" : "default",
              }}
              onPointerDown={() => {
                if (canSubmit) submitAnswer(selected);
              }}
            >
              Submit
            </button>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-4 pb-4 flex-shrink-0 text-center min-h-[24px]">
        {phase === "recall" && (
          <p className="text-white/25 text-xs tracking-widest uppercase">
            Tap the {config.litCount} tiles that lit up
          </p>
        )}
        {phase === "flash" && (
          <p className="text-white/20 text-xs tracking-widest uppercase">
            Watch carefully
          </p>
        )}
      </div>
    </div>
  );
});

Flashbang.displayName = "Flashbang";
export default Flashbang;
