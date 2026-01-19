/**
 * VisualTimerBar.tsx - MINIMALIST PROGRESS BAR TIMER
 * 
 * No numbers, no clock icon. Just a visual bar that depletes.
 * Blue → Yellow → Red as time runs out.
 * 
 * Paste into bolt.new as components/VisualTimerBar.tsx
 */

import React from 'react';

interface VisualTimerBarProps {
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  onTimeUp?: () => void;
}

export default function VisualTimerBar({ 
  timeRemaining, 
  totalTime, 
  onTimeUp 
}: VisualTimerBarProps) {
  
  // Calculate percentage
  const percentage = (timeRemaining / totalTime) * 100;
  
  // Determine color based on time remaining
  const getBarColor = () => {
    if (percentage > 66) {
      // Plenty of time: Blue
      return 'from-blue-500 to-blue-600';
    } else if (percentage > 33) {
      // Medium time: Yellow
      return 'from-amber-400 to-yellow-500';
    } else if (percentage > 10) {
      // Low time: Orange/Red
      return 'from-orange-500 to-red-500';
    } else {
      // Critical: Deep Red with pulse
      return 'from-red-600 to-red-700';
    }
  };

  const isPulsing = percentage < 15;

  return (
    <div className="w-full px-4 py-4 bg-gray-900">
      {/* Outer container - defines the "track" */}
      <div className="w-full h-6 bg-gray-800 rounded-full border border-gray-700 shadow-lg overflow-hidden">
        {/* Inner bar - the progress */}
        <div
          className={`
            h-full bg-gradient-to-r ${getBarColor()}
            transition-all duration-100 rounded-full
            shadow-inner
            ${isPulsing ? 'animate-pulse' : ''}
          `}
          style={{ 
            width: `${percentage}%`,
            boxShadow: isPulsing 
              ? '0 0 20px rgba(239, 68, 68, 0.8)' 
              : 'inset 0 1px 3px rgba(0, 0, 0, 0.5)'
          }}
        />
      </div>
    </div>
  );
}

/**
 * VISUAL MOCKUP - What it looks like:
 * 
 * FULL TIME (100%):
 * ╔═════════════════════════════════════════════════════════════╗
 * ║ ████████████████████████████████████████████████████████ ║
 * ║              (solid blue, full width)                      ║
 * ╚═════════════════════════════════════════════════════════════╝
 * 
 * MEDIUM TIME (50%):
 * ╔═════════════════════════════════════════════════════════════╗
 * ║ ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
 * ║   (transitions to yellow as depletes)                      ║
 * ╚═════════════════════════════════════════════════════════════╝
 * 
 * LOW TIME (20%):
 * ╔═════════════════════════════════════════════════════════════╗
 * ║ ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
 * ║ (red, pulsing glow)                                        ║
 * ╚═════════════════════════════════════════════════════════════╝
 */

/**
 * COLOR PROGRESSION:
 * 
 * 100% → 67%:  BLUE (plenty of time)
 * 66% → 34%:   YELLOW/AMBER (medium time)
 * 33% → 11%:   ORANGE/RED (low time)
 * 10% → 0%:    RED + PULSING (critical!)
 * 
 * The colors transition smoothly without text.
 * Player sees urgency at a glance.
 */

/**
 * USAGE IN GAMEWRAPPER.TSX:
 * 
 * Replace current timer with:
 * 
 * <VisualTimerBar 
 *   timeRemaining={timeLeft}
 *   totalTime={duration}
 *   onTimeUp={() => handleGameEnd()}
 * />
 * 
 * That's it! Clean, minimal, no distractions.
 */

/**
 * DIMENSIONS:
 * 
 * Width: Full width of game area (96-98% with padding)
 * Height: 24px (h-6 in Tailwind)
 * Border radius: Full (rounded-full = pill shape)
 * Padding: 16px (py-4) top/bottom, 16px (px-4) left/right
 * 
 * On mobile: Still full width, responsive
 */

/**
 * ANIMATION:
 * 
 * Normal: Smooth depletion (transition-all duration-100)
 *         No jarring jumps, just steady drain
 * 
 * Critical (<15%): Added pulse animation
 *                 Creates urgency without sound
 *                 Red glow effect (box-shadow)
 */
