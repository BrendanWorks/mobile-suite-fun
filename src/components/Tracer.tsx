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

type Phase = "show" | "go" | "trace" | "score";
type ShapeType = "circle" | "triangle" | "star" | "spiral" | "freeform";

const SHAPES: ShapeType[] = ["circle", "triangle", "star", "spiral", "freeform"];
const SHOW_DURATIONS: Record<ShapeType, number> = {
  circle: 1200,
  triangle: 1500,
  star: 1800,
  spiral: 2200,
  freeform: 2500,
};
const TOTAL_ROUNDS = 5;
const MAX_SCORE = 1000;
const SAMPLE_POINTS = 200;
const HIT_RADIUS = 20;
const CANVAS_SIZE = 280;

interface Point {
  x: number;
  y: number;
}

function sampleCircle(cx: number, cy: number, r: number): Point[] {
  return Array.from({ length: SAMPLE_POINTS }, (_, i) => {
    const a = (i / SAMPLE_POINTS) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

function sampleTriangle(cx: number, cy: number, r: number): Point[] {
  const verts: Point[] = Array.from({ length: 3 }, (_, i) => {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  const pts: Point[] = [];
  for (let s = 0; s < 3; s++) {
    const a = verts[s];
    const b = verts[(s + 1) % 3];
    const seg = Math.floor(SAMPLE_POINTS / 3);
    for (let i = 0; i < seg; i++) {
      const t = i / seg;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return pts;
}

function sampleStar(cx: number, cy: number, outerR: number): Point[] {
  const innerR = outerR * 0.4;
  const spikes = 5;
  const verts: Point[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    verts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  const pts: Point[] = [];
  const seg = Math.floor(SAMPLE_POINTS / verts.length);
  for (let s = 0; s < verts.length; s++) {
    const a = verts[s];
    const b = verts[(s + 1) % verts.length];
    for (let i = 0; i < seg; i++) {
      const t = i / seg;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return pts;
}

function sampleSpiral(cx: number, cy: number, maxR: number): Point[] {
  const turns = 2.5;
  return Array.from({ length: SAMPLE_POINTS }, (_, i) => {
    const t = i / SAMPLE_POINTS;
    const a = t * turns * Math.PI * 2;
    const r = maxR * 0.15 + maxR * 0.85 * t;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

function sampleFreeform(cx: number, cy: number, r: number): Point[] {
  const controlPoints: Point[] = [
    { x: cx, y: cy - r },
    { x: cx + r * 0.8, y: cy - r * 0.3 },
    { x: cx + r * 0.5, y: cy + r * 0.8 },
    { x: cx - r * 0.3, y: cy + r * 0.6 },
    { x: cx - r * 0.9, y: cy + r * 0.2 },
    { x: cx - r * 0.6, y: cy - r * 0.7 },
    { x: cx, y: cy - r },
  ];
  const pts: Point[] = [];
  const segsPerSpan = Math.floor(SAMPLE_POINTS / (controlPoints.length - 1));
  for (let s = 0; s < controlPoints.length - 1; s++) {
    const p0 = controlPoints[Math.max(0, s - 1)];
    const p1 = controlPoints[s];
    const p2 = controlPoints[s + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, s + 2)];
    for (let i = 0; i < segsPerSpan; i++) {
      const t = i / segsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      pts.push({ x, y });
    }
  }
  return pts;
}

function getSamplePoints(shape: ShapeType, cx: number, cy: number): Point[] {
  const r = CANVAS_SIZE * 0.32;
  switch (shape) {
    case "circle": return sampleCircle(cx, cy, r);
    case "triangle": return sampleTriangle(cx, cy, r);
    case "star": return sampleStar(cx, cy, r);
    case "spiral": return sampleSpiral(cx, cy, r);
    case "freeform": return sampleFreeform(cx, cy, r);
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeType, cx: number, cy: number, color: string, lineWidth: number) {
  const pts = getSamplePoints(shape, cx, cy);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  if (shape !== "spiral") ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function scoreTrace(shape: ShapeType, playerStrokes: Point[][], cx: number, cy: number): number {
  const targets = getSamplePoints(shape, cx, cy);
  const allPlayerPts = playerStrokes.flat();
  if (allPlayerPts.length === 0) return 0;
  let matched = 0;
  for (const t of targets) {
    for (const p of allPlayerPts) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        matched++;
        break;
      }
    }
  }
  return Math.round((matched / targets.length) * 200);
}

const Tracer = forwardRef<GameHandle, GameProps>(({ onScoreUpdate, onComplete }, ref) => {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("show");
  const [totalScore, setTotalScore] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [shakeBtn, setShakeBtn] = useState(false);

  const scoreRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentStrokeRef = useRef<Point[] | null>(null);
  const isDrawingRef = useRef(false);
  const phaseRef = useRef<Phase>("show");
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({ score: scoreRef.current, maxScore: MAX_SCORE }),
    onGameEnd: () => {},
    pauseTimer: false,
  }));

  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;

  const renderShowPhase = useCallback((shape: ShapeType, pulse: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const alpha = pulse ? 0.6 + 0.4 * Math.sin(Date.now() / 200) : 1;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 18;
    drawShape(ctx, shape, cx, cy, "#00ffff", 3);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [cx, cy]);

  const renderTracePhase = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    ctx.shadowColor = "#ec4899";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const allStrokes = [...strokesRef.current];
    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      allStrokes.push(currentStrokeRef.current);
    }

    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }, [cx, cy]);

  const renderScorePhase = useCallback((shape: ShapeType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.shadowColor = "#ec4899";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 18;
    drawShape(ctx, shape, cx, cy, "#22c55e", 3);
    ctx.shadowBlur = 0;
  }, [cx, cy]);

  const startRound = useCallback((roundIndex: number) => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    phaseRef.current = "show";
    setPhase("show");

    const shape = SHAPES[roundIndex];

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const animate = () => {
      if (phaseRef.current === "show") {
        renderShowPhase(shape, true);
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animate();

    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (goTimerRef.current) clearTimeout(goTimerRef.current);

    showTimerRef.current = setTimeout(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      phaseRef.current = "go";
      setPhase("go");

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      goTimerRef.current = setTimeout(() => {
        phaseRef.current = "trace";
        setPhase("trace");
        strokesRef.current = [];
        renderTracePhase();
      }, 400);
    }, SHOW_DURATIONS[shape]);
  }, [renderShowPhase, renderTracePhase]);

  useEffect(() => {
    startRound(0);
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (goTimerRef.current) clearTimeout(goTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [startRound]);

  const getCanvasPoint = (e: React.Touch | React.MouseEvent, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const clientX = "clientX" in e ? e.clientX : (e as React.Touch).clientX;
    const clientY = "clientY" in e ? e.clientY : (e as React.Touch).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phaseRef.current !== "trace") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const pt = "touches" in e
      ? getCanvasPoint(e.touches[0], canvas)
      : getCanvasPoint(e as React.MouseEvent, canvas);
    currentStrokeRef.current = [pt];
    renderTracePhase();
  }, [renderTracePhase]);

  const handlePointerMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current || phaseRef.current !== "trace") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = "touches" in e
      ? getCanvasPoint(e.touches[0], canvas)
      : getCanvasPoint(e as React.MouseEvent, canvas);
    if (currentStrokeRef.current) {
      currentStrokeRef.current.push(pt);
    }
    renderTracePhase();
  }, [renderTracePhase]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
    }
    renderTracePhase();
  }, [renderTracePhase]);

  const submitTrace = useCallback(() => {
    if (phaseRef.current !== "trace") return;
    const allPts = strokesRef.current.flat();
    if (allPts.length < 5) {
      setShakeBtn(true);
      setTimeout(() => setShakeBtn(false), 500);
      return;
    }
    const shape = SHAPES[round];
    const rs = scoreTrace(shape, strokesRef.current, cx, cy);
    setRoundScore(rs);
    setDisplayedScore(0);
    phaseRef.current = "score";
    setPhase("score");
    renderScorePhase(shape);

    const newTotal = totalScore + rs;
    setTotalScore(newTotal);
    scoreRef.current = newTotal;
    onScoreUpdate?.(newTotal, MAX_SCORE);

    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    let displayed = 0;
    animIntervalRef.current = setInterval(() => {
      displayed += Math.ceil(rs / 20);
      if (displayed >= rs) {
        displayed = rs;
        if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      }
      setDisplayedScore(displayed);
    }, 40);
  }, [round, totalScore, cx, cy, renderScorePhase, onScoreUpdate]);

  const nextRound = useCallback(() => {
    const nextRoundIndex = round + 1;
    if (nextRoundIndex >= TOTAL_ROUNDS) {
      setGameOver(true);
      onComplete?.(scoreRef.current, MAX_SCORE, 0);
      return;
    }
    setRound(nextRoundIndex);
    setRoundScore(0);
    setDisplayedScore(0);
    startRound(nextRoundIndex);
  }, [round, startRound, onComplete]);

  if (gameOver) {
    return (
      <div className="h-full bg-black flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px #00ffff)" }}>
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
            <h1 className="text-3xl font-black tracking-wider text-cyan-300" style={{ textShadow: "0 0 20px rgba(0,255,255,0.8)" }}>
              Tracer
            </h1>
          </div>
          <div className="border border-cyan-400/30 rounded-2xl p-6 mb-6" style={{ background: "rgba(0,255,255,0.04)", boxShadow: "0 0 30px rgba(0,255,255,0.08)" }}>
            <p className="text-white/50 text-sm uppercase tracking-widest mb-2">Final Score</p>
            <p className="text-6xl font-black text-cyan-300" style={{ textShadow: "0 0 30px rgba(0,255,255,0.6)" }}>
              {scoreRef.current}
            </p>
            <p className="text-white/30 text-sm mt-2">out of {MAX_SCORE}</p>
          </div>
        </div>
      </div>
    );
  }

  const shape = SHAPES[round];
  const shapeLabel = shape.charAt(0).toUpperCase() + shape.slice(1);

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden">

      {/* Top row: score left, title center, round right */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px #00ffff)" }}>
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
          <h1 className="text-xl font-bold tracking-wide text-cyan-300" style={{ textShadow: "0 0 10px rgba(0,255,255,0.6)" }}>
            Tracer
          </h1>
        </div>

        <span className="text-white/40 text-xs tracking-wider uppercase min-w-[60px] text-right">
          {round + 1}/{TOTAL_ROUNDS}
        </span>
      </div>

      {/* Progress pips */}
      <div className="flex gap-1.5 px-3 pb-1 flex-shrink-0">
        {SHAPES.map((_, i) => (
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

      {/* Phase badge */}
      <div className="flex items-center justify-between px-3 pb-1 flex-shrink-0">
        <div
          className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border"
          style={{
            color: phase === "show" ? "#00ffff" : phase === "go" ? "#f59e0b" : phase === "trace" ? "#ec4899" : "#22c55e",
            borderColor: phase === "show" ? "rgba(0,255,255,0.4)" : phase === "go" ? "rgba(245,158,11,0.5)" : phase === "trace" ? "rgba(236,72,153,0.4)" : "rgba(34,197,94,0.4)",
            background: phase === "show" ? "rgba(0,255,255,0.08)" : phase === "go" ? "rgba(245,158,11,0.12)" : phase === "trace" ? "rgba(236,72,153,0.08)" : "rgba(34,197,94,0.08)",
          }}
        >
          {phase === "show" ? "Memorize…" : phase === "go" ? "GO!" : phase === "trace" ? "Draw it" : "Score"}
        </div>
        <span className="text-white/40 text-xs">{shapeLabel}</span>
      </div>

      {/* Canvas — fills available space */}
      <div className="flex-1 px-3 min-h-0 flex items-center justify-center">
        <div
          className="relative rounded-2xl overflow-hidden border w-full"
          style={{
            maxWidth: CANVAS_SIZE,
            aspectRatio: "1",
            borderColor: phase === "show" ? "rgba(0,255,255,0.3)" : phase === "go" ? "rgba(245,158,11,0.5)" : phase === "trace" ? "rgba(236,72,153,0.3)" : "rgba(34,197,94,0.3)",
            boxShadow: phase === "show"
              ? "0 0 20px rgba(0,255,255,0.12)"
              : phase === "go"
              ? "0 0 30px rgba(245,158,11,0.25)"
              : phase === "trace"
              ? "0 0 20px rgba(236,72,153,0.12)"
              : "0 0 20px rgba(34,197,94,0.12)",
            background: "#000",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ width: "100%", height: "100%", touchAction: "none", display: "block" }}
            className="touch-manipulation"
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
          />
          {phase === "go" && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)" }}
            >
              <span
                className="font-black text-6xl"
                style={{
                  color: "#f59e0b",
                  textShadow: "0 0 40px #f59e0b, 0 0 80px rgba(245,158,11,0.5)",
                  animation: "pulse 0.2s ease-out",
                }}
              >
                GO!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom area — always visible */}
      <div className="px-3 pb-3 pt-2 flex-shrink-0">
        {phase === "score" && (
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest leading-none mb-0.5">Round</p>
              <p
                className="text-3xl font-black leading-none"
                style={{
                  color: roundScore >= 140 ? "#22c55e" : roundScore >= 80 ? "#f59e0b" : "#ef4444",
                  textShadow: roundScore >= 140
                    ? "0 0 16px rgba(34,197,94,0.7)"
                    : roundScore >= 80
                    ? "0 0 16px rgba(245,158,11,0.7)"
                    : "0 0 16px rgba(239,68,68,0.7)",
                }}
              >
                {displayedScore}
              </p>
              <p className="text-white/25 text-xs">/ 200</p>
            </div>
          </div>
        )}

        {phase === "trace" && (
          <button
            onClick={submitTrace}
            className="w-full py-3.5 rounded-xl font-bold tracking-widest uppercase text-sm active:scale-95 transition-all"
            style={{
              background: "rgba(236,72,153,0.15)",
              border: "1px solid rgba(236,72,153,0.5)",
              color: "#ec4899",
              boxShadow: "0 0 16px rgba(236,72,153,0.2)",
              transform: shakeBtn ? "translateX(0)" : undefined,
              animation: shakeBtn ? "shake 0.4s ease-in-out" : undefined,
            }}
          >
            Done
          </button>
        )}

        {phase === "score" && (
          <button
            onClick={nextRound}
            className="w-full py-3.5 rounded-xl font-bold tracking-widest uppercase text-sm active:scale-95 transition-transform"
            style={{
              background: "rgba(236,72,153,0.15)",
              border: "1px solid rgba(236,72,153,0.5)",
              color: "#ec4899",
              boxShadow: "0 0 16px rgba(236,72,153,0.2)",
            }}
          >
            {round + 1 >= TOTAL_ROUNDS ? "See Results" : "Next Shape →"}
          </button>
        )}

        {/* Difficulty indicator — lower left */}
        {phase === "show" && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-white/30 text-xs">Difficulty:</span>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: i <= (round + 1) ? "#00ffff" : "rgba(255,255,255,0.12)",
                    boxShadow: i <= (round + 1) ? "0 0 4px #00ffff" : "none",
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Tracer.displayName = "Tracer";
export default Tracer;
