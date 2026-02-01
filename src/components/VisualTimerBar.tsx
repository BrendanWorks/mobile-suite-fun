/**
 * VisualTimerBar.tsx - NEON PROGRESS BAR TIMER
 * 
 * Pure analog readout - just a glowing cyan bar that depletes.
 * No color changes, no numbers. Minimalist neon aesthetic.
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

  return (
    <div className="w-full px-2 py-2">
      {/* Outer container - black with cyan border */}
      <div 
        className="w-full h-2 bg-black rounded-lg border-2 border-cyan-400 overflow-hidden"
        style={{ 
          boxShadow: '0 0 15px rgba(0, 255, 255, 0.4), inset 0 0 10px rgba(0, 255, 255, 0.1)'
        }}
      >
        {/* Inner bar - cyan with glow */}
        <div
          className="h-full bg-cyan-400 transition-all duration-300"
          style={{ 
            width: `${percentage}%`,
            boxShadow: '0 0 20px #00ffff'
          }}
        />
      </div>
    </div>
  );
}

/**
 * NEON AESTHETIC:
 * 
 * - Black background (#000)
 * - Cyan border (#00ffff / cyan-400)
 * - Cyan progress bar with glow
 * - No color changes (stays cyan throughout)
 * - Thin bar (8px / h-2)
 * - Rounded corners
 * - Neon glow effects (box-shadow)
 * 
 * Visual cue: The bar depleting is enough.
 * No pulsing, no color shifts. Pure minimalism.
 */

/**
 * DIMENSIONS:
 * 
 * Width: Full width with 8px padding (px-2)
 * Height: 8px (h-2)
 * Border: 2px solid cyan (border-2 border-cyan-400)
 * Padding: 8px (py-2) top/bottom, 8px (px-2) left/right
 * 
 * Mobile-friendly, compact, doesn't steal vertical space.
 */