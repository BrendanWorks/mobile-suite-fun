import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- Types & Constants (same as before) ---
const ZOOM_LEVEL = 3;
const LENS_SIZE = 120; // px

export default function SpotTheFake({ onScoreUpdate, onComplete }: any) {
  // ... (Previous State Logic)

  return (
    <div className="flex flex-col h-full bg-black text-white p-2 sm:p-4 font-mono select-none overflow-hidden">
      {/* HUD Section */}
      <div className="flex justify-between items-end mb-4 border-b-2 border-cyan-900 pb-2">
         {/* ... (Same HUD as before) ... */}
      </div>

      {/* Gameplay Grid */}
      <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-4 items-center">
        <ImageSlot 
          url={aiSide === 'left' ? current?.ai_image_url : current?.real_image_url}
          isAI={aiSide === 'left'}
          status={status}
          onSelect={() => handleChoice('left')}
        />
        <ImageSlot 
          url={aiSide === 'right' ? current?.ai_image_url : current?.real_image_url}
          isAI={aiSide === 'right'}
          status={status}
          onSelect={() => handleChoice('right')}
        />
      </div>

      {/* Footer / Streak info */}
    </div>
  );
}

function ImageSlot({ url, isAI, status, onSelect }: any) {
  const [showMagnifier, setShowMagnifier] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const isFeedback = status === 'feedback';

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!showMagnifier || !containerRef.current || !lensRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    // Constrain lens to image bounds
    const posX = Math.max(0, Math.min(x, bounds.width));
    const posY = Math.max(0, Math.min(y, bounds.height));

    // Move the lens
    lensRef.current.style.left = `${posX - LENS_SIZE / 2}px`;
    lensRef.current.style.top = `${posY - LENS_SIZE / 2}px`;

    // Calculate background position for zoom
    const bgX = (posX / bounds.width) * 100;
    const bgY = (posY / bounds.height) * 100;
    lensRef.current.style.backgroundPosition = `${bgX}% ${bgY}%`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isFeedback) return;
    
    // Start a timer for "Long Press"
    pressTimer.current = setTimeout(() => {
      setShowMagnifier(true);
      // Trigger haptic feedback if available
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 250); // 250ms threshold for zoom
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }

    if (showMagnifier) {
      setShowMagnifier(false);
    } else if (!isFeedback) {
      onSelect(); // It was a tap, not a long-press
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
      className={`relative w-full aspect-[3/4] rounded-sm border-2 overflow-hidden transition-all duration-300 touch-none
        ${isFeedback ? (isAI ? 'border-green-500 shadow-[0_0_15px_#22c55e]' : 'border-red-500') : 'border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]'}`}
    >
      <img src={url} className="w-full h-full object-cover pointer-events-none" alt="Detect" />

      {/* The Magnifier Lens */}
      <div
        ref={lensRef}
        style={{
          width: LENS_SIZE,
          height: LENS_SIZE,
          backgroundImage: `url(${url})`,
          backgroundSize: `${100 * ZOOM_LEVEL}%`,
          display: showMagnifier ? 'block' : 'none',
          boxShadow: '0 0 20px rgba(0,0,0,0.5), 0 0 0 2px #00ffff',
        }}
        className="absolute pointer-events-none rounded-full border-2 border-cyan-400 z-50 bg-no-repeat"
      />

      {/* Label Overlay during feedback */}
      {isFeedback && (
        <div className={`absolute bottom-0 left-0 right-0 py-1 text-[10px] font-black uppercase text-center z-10
          ${isAI ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
          {isAI ? '🤖 AI GENERATED' : '📷 AUTHENTIC'}
        </div>
      )}

      {/* Help Hint */}
      {!isFeedback && (
        <div className="absolute top-2 left-2 bg-black/50 px-1 text-[8px] text-cyan-400 uppercase tracking-tighter">
          Hold to Zoom
        </div>
      )}
    </div>
  );
}