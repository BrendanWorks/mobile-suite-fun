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

const TOTAL_ROUNDS = 5;
const MAX_SCORE = 1000;
const MAX_ROUND_SCORE = 200;
const CANVAS_SIZE = 340;
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;
const BULLSEYE_R = 12;
const OUTER_START_R = 148;

interface RoundConfig {
  durationMs: number;
  sweetSpotFraction: number;
}

const ROUND_CONFIGS: RoundConfig[] = [
  { durationMs: 3200, sweetSpotFraction: 0.22 },
  { durationMs: 2600, sweetSpotFraction: 0.17 },
  { durationMs: 2100, sweetSpotFraction: 0.13 },
  { durationMs: 1600, sweetSpotFraction: 0.09 },
  { durationMs: 1200, sweetSpotFraction: 0.06 },
];

type RoundPhase = "get-ready" | "shrinking" | "result" | "game-over";

interface TapResult {
  kind: "perfect" | "clutch" | "too-early" | "too-late";
  score: number;
  ringRadius: number;
}

function computeScore(ringR: number, sweetInner: number, sweetOuter: number): TapResult {
  const travel = OUTER_START_R - BULLSEYE_R;
  const distFromCenter = ringR - BULLSEYE_R;

  if (ringR <= BULLSEYE_R + 2) {
    const score = MAX_ROUND_SCORE;
    return { kind: "perfect", score, ringRadius: ringR };
  }

  if (ringR >= sweetInner && ringR <= sweetOuter) {
    const fraction = distFromCenter / travel;
    const score = Math.round(MAX_ROUND_SCORE * (1 - fraction * 0.5));
    return { kind: "clutch", score, ringRadius: ringR };
  }

  if (ringR > sweetOuter) {
    const excess = ringR - sweetOuter;
    const score = Math.max(0, Math.round(50 * (1 - excess / (OUTER_START_R - sweetOuter))));
    return { kind: "too-early", score, ringRadius: ringR };
  }

  const score = Math.max(0, Math.round(30 * (ringR / BULLSEYE_R)));
  return { kind: "too-late", score, ringRadius: ringR };
}

function getSweetSpotBounds(config: RoundConfig): { inner: number; outer: number } {
  const travel = OUTER_START_R - BULLSEYE_R;
  const halfSpan = (config.sweetSpotFraction * travel) / 2;
  const center = BULLSEYE_R + travel * 0.12;
  return {
    inner: Math.max(BULLSEYE_R + 2, center - halfSpan),
    outer: center + halfSpan,
  };
}

const Clutch = forwardRef<GameHandle, GameProps>(({ onScoreUpdate, onComplete }, ref) => {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<RoundPhase>("get-ready");
  const [totalScore, setTotalScore] = useState(0);
  const [tapResult, setTapResult] = useState<TapResult | null>(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const scoreRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const ringRadiusRef = useRef(OUTER_START_R);
  const phaseRef = useRef<RoundPhase>("get-ready");
  const roundRef = useRef(0);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: MAX_SCORE }),
    onGameEnd: () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    },
    pauseTimer: false,
  }));

  const drawFrame = useCallback((ringR: number, resultKind?: TapResult["kind"]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const config = ROUND_CONFIGS[roundRef.current] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    const { inner: sweetInner, outer: sweetOuter } = getSweetSpotBounds(config);

    ctx.beginPath();
    ctx.arc(CX, CY, BULLSEYE_R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    const arcThickness = Math.max(2, (sweetOuter - sweetInner) * 0.9);
    const arcMidR = (sweetInner + sweetOuter) / 2;
    ctx.beginPath();
    ctx.arc(CX, CY, arcMidR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251,191,36,0.35)";
    ctx.lineWidth = arcThickness;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CX, CY, arcMidR, 0, Math.PI * 2);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (ringR > BULLSEYE_R) {
      let ringColor = "#00ffff";
      let ringGlow = "#00ffff";
      let ringWidth = 3;

      if (resultKind === "perfect") {
        ringColor = "#ffffff";
        ringGlow = "#ffffff";
        ringWidth = 4;
      } else if (resultKind === "clutch") {
        ringColor = "#fbbf24";
        ringGlow = "#fbbf24";
        ringWidth = 3.5;
      } else if (resultKind === "too-early" || resultKind === "too-late") {
        ringColor = "#ef4444";
        ringGlow = "#ef4444";
        ringWidth = 3;
      }

      ctx.beginPath();
      ctx.arc(CX, CY, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = ringWidth;
      ctx.shadowColor = ringGlow;
      ctx.shadowBlur = resultKind ? 24 : 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, []);

  const runShrinkLoop = useCallback(() => {
    const config = ROUND_CONFIGS[roundRef.current] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];

    const tick = (now: number) => {
      if (phaseRef.current !== "shrinking") return;

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / config.durationMs, 1);
      const ringR = OUTER_START_R - (OUTER_START_R - BULLSEYE_R) * progress;
      ringRadiusRef.current = ringR;

      drawFrame(ringR);

      if (progress >= 1) {
        phaseRef.current = "result";
        setPhase("result");
        const result: TapResult = { kind: "too-late", score: 0, ringRadius: BULLSEYE_R };
        setTapResult(result);
        drawFrame(BULLSEYE_R, "too-late");
        scheduleNextRound();
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    startTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(tick);
  }, [drawFrame]);

  const scheduleNextRound = useCallback(() => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => {
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
      setTapResult(null);
      ringRadiusRef.current = OUTER_START_R;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      readyTimerRef.current = setTimeout(() => {
        phaseRef.current = "shrinking";
        setPhase("shrinking");
        runShrinkLoop();
      }, 700);
    }, 900);
  }, [runShrinkLoop, onComplete]);

  const handleTap = useCallback(() => {
    if (phaseRef.current !== "shrinking") return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const config = ROUND_CONFIGS[roundRef.current] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    const { inner: sweetInner, outer: sweetOuter } = getSweetSpotBounds(config);
    const ringR = ringRadiusRef.current;
    const result = computeScore(ringR, sweetInner, sweetOuter);

    phaseRef.current = "result";
    setPhase("result");
    setTapResult(result);
    drawFrame(ringR, result.kind);

    const newTotal = scoreRef.current + result.score;
    scoreRef.current = newTotal;
    setTotalScore(newTotal);
    onScoreUpdate?.(newTotal, MAX_SCORE);

    if (result.kind === "perfect") {
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 200);
    }

    scheduleNextRound();
  }, [drawFrame, scheduleNextRound, onScoreUpdate]);

  useEffect(() => {
    roundRef.current = 0;
    phaseRef.current = "get-ready";

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    readyTimerRef.current = setTimeout(() => {
      phaseRef.current = "shrinking";
      setPhase("shrinking");
      runShrinkLoop();
    }, 700);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, [runShrinkLoop]);

  if (gameOver) {
    return (
      <div className="h-full bg-black flex items-center justify-center p-4">
        <div className="max-w-xs w-full text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px #00ffff)" }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l2 2.5L16 9" />
            </svg>
            <h1 className="text-3xl font-black tracking-wider text-cyan-300" style={{ textShadow: "0 0 20px rgba(0,255,255,0.8)" }}>
              Clutch
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

  const resultLabel = tapResult
    ? tapResult.kind === "perfect"
      ? "PERFECT!"
      : tapResult.kind === "clutch"
      ? "CLUTCH!"
      : tapResult.kind === "too-early"
      ? "TOO EARLY"
      : "TOO LATE"
    : null;

  const resultColor = tapResult
    ? tapResult.kind === "perfect"
      ? "#ffffff"
      : tapResult.kind === "clutch"
      ? "#fbbf24"
      : "#ef4444"
    : "#ffffff";

  const resultGlow = tapResult
    ? tapResult.kind === "perfect"
      ? "rgba(255,255,255,0.8)"
      : tapResult.kind === "clutch"
      ? "rgba(251,191,36,0.8)"
      : "rgba(239,68,68,0.8)"
    : "rgba(255,255,255,0.8)";

  return (
    <div
      className="h-full bg-black flex flex-col overflow-hidden select-none"
      onTouchStart={handleTap}
      onMouseDown={handleTap}
      style={{ cursor: phase === "shrinking" ? "crosshair" : "default" }}
    >
      {screenFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-50"
          style={{ background: "rgba(255,255,255,0.25)", transition: "opacity 0.2s" }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 flex-shrink-0">
        <div className="flex flex-col items-start min-w-[60px]">
          <span className="text-white/40 text-xs uppercase tracking-widest leading-none mb-0.5">Score</span>
          <span className="text-yellow-400 text-2xl font-black leading-none" style={{ textShadow: "0 0 12px #fbbf24" }}>
            {totalScore}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px #00ffff)" }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l2 2.5L16 9" />
          </svg>
          <h1 className="text-xl font-bold tracking-wide text-cyan-300" style={{ textShadow: "0 0 10px rgba(0,255,255,0.6)" }}>
            Clutch
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

      {/* Canvas area — tap target fills this */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        <div
          className="relative"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, maxWidth: "100%", maxHeight: "100%" }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ width: "100%", height: "100%", display: "block" }}
          />

          {/* Get Ready overlay */}
          {phase === "get-ready" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p
                  className="text-2xl font-black tracking-widest uppercase"
                  style={{
                    color: "#00ffff",
                    textShadow: "0 0 20px rgba(0,255,255,0.8)",
                    animation: "pulse 0.6s ease-in-out",
                  }}
                >
                  Get Ready…
                </p>
                <p className="text-white/30 text-sm mt-1 tracking-wider">
                  {ROUND_CONFIGS[round] && `Round ${round + 1} of ${TOTAL_ROUNDS}`}
                </p>
              </div>
            </div>
          )}

          {/* Result overlay */}
          {phase === "result" && tapResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p
                  className="font-black tracking-widest uppercase"
                  style={{
                    fontSize: "clamp(1.8rem, 8vw, 2.5rem)",
                    color: resultColor,
                    textShadow: `0 0 30px ${resultGlow}, 0 0 60px ${resultGlow}`,
                  }}
                >
                  {resultLabel}
                </p>
                <p
                  className="font-black mt-1"
                  style={{
                    fontSize: "clamp(1.4rem, 6vw, 2rem)",
                    color: tapResult.score > 0 ? resultColor : "#ef4444",
                    textShadow: `0 0 20px ${resultGlow}`,
                    opacity: 0.9,
                  }}
                >
                  +{tapResult.score}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-4 pb-4 flex-shrink-0 text-center">
        {phase === "shrinking" && (
          <p className="text-white/25 text-xs tracking-widest uppercase">
            Tap when the ring hits gold
          </p>
        )}
        {phase === "get-ready" && (
          <p className="text-white/20 text-xs tracking-widest uppercase">
            Tap anywhere
          </p>
        )}
        {phase === "result" && (
          <div className="flex items-center justify-center gap-1">
            <span className="text-white/30 text-xs">Total</span>
            <span className="text-yellow-400 font-bold text-sm ml-2" style={{ textShadow: "0 0 8px #fbbf24" }}>
              {totalScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

Clutch.displayName = "Clutch";
export default Clutch;
