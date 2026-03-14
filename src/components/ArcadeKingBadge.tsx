interface ArcadeKingBadgeProps {
  size?: number;
  showLabel?: boolean;
}

export function ArcadeKingBadgeIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter:
          'drop-shadow(0 0 6px rgba(0,255,255,0.8)) drop-shadow(0 0 14px rgba(251,191,36,0.45))',
      }}
    >
      <defs>
        <linearGradient id="akCabinetGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e3a4a" />
          <stop offset="100%" stopColor="#061820" />
        </linearGradient>

        <linearGradient id="akScreenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#001a1a" />
          <stop offset="100%" stopColor="#003333" />
        </linearGradient>

        <linearGradient id="akBezelGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0.7" />
        </linearGradient>

        <radialGradient id="akScreenGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="akButtonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>

        <filter id="akGlow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="akStrongGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Cabinet body */}
      <path
        d="M10 4 L38 4 L38 44 L10 44 Z"
        fill="url(#akCabinetGrad)"
        stroke="#00ffff"
        strokeWidth="1"
        strokeOpacity="0.7"
      />

      {/* Cabinet top arch */}
      <path
        d="M10 4 Q24 0 38 4"
        stroke="#00ffff"
        strokeWidth="1.2"
        strokeOpacity="0.9"
        fill="none"
        filter="url(#akGlow)"
      />

      {/* Marquee panel (top banner) */}
      <rect x="11" y="5" width="26" height="7" rx="1" fill="#001515" stroke="#00ffff" strokeWidth="0.7" strokeOpacity="0.6" />
      <rect x="11" y="5" width="26" height="7" rx="1" fill="url(#akScreenGlow)" />

      {/* Marquee text glow lines */}
      <line x1="14" y1="7.5" x2="34" y2="7.5" stroke="url(#akBezelGrad)" strokeWidth="0.8" />
      <line x1="14" y1="9.5" x2="34" y2="9.5" stroke="url(#akBezelGrad)" strokeWidth="0.6" strokeOpacity="0.6" />

      {/* Marquee crown symbol */}
      <path
        d="M20 9 L22 7 L24 8.5 L26 7 L28 9 L26.5 9 L24 7.8 L21.5 9 Z"
        fill="#fbbf24"
        filter="url(#akGlow)"
      />

      {/* Bezel frame around screen */}
      <rect x="12" y="13" width="24" height="16" rx="1.5" fill="#001010" stroke="#00ffff" strokeWidth="1" strokeOpacity="0.8" />

      {/* Screen */}
      <rect x="13.5" y="14.5" width="21" height="13" rx="1" fill="url(#akScreenGrad)" />
      <rect x="13.5" y="14.5" width="21" height="13" rx="1" fill="url(#akScreenGlow)" />

      {/* Screen scanlines */}
      <line x1="14" y1="17" x2="34" y2="17" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.2" />
      <line x1="14" y1="19" x2="34" y2="19" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.2" />
      <line x1="14" y1="21" x2="34" y2="21" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.2" />
      <line x1="14" y1="23" x2="34" y2="23" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.2" />
      <line x1="14" y1="25" x2="34" y2="25" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.2" />

      {/* Screen pixel art — simple "INSERT COIN" style cross/player icon */}
      <rect x="22" y="16" width="4" height="1.5" rx="0.3" fill="#00ffff" opacity="0.7" />
      <rect x="23.2" y="17.5" width="1.6" height="3" rx="0.3" fill="#00ffff" opacity="0.7" />

      {/* Score display on screen */}
      <text x="14.5" y="24.5" fontSize="3" fill="#fbbf24" fillOpacity="0.9" fontFamily="monospace" fontWeight="bold">HI 999999</text>

      {/* Control panel area */}
      <rect x="11" y="30" width="26" height="9" rx="1" fill="#071c22" stroke="#00ffff" strokeWidth="0.7" strokeOpacity="0.5" />

      {/* Joystick */}
      <circle cx="18" cy="35" r="3" fill="#0a2a33" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.7" />
      <circle cx="18" cy="35" r="1.5" fill="#00ffff" opacity="0.5" />
      <line x1="18" y1="32.5" x2="18" y2="35" stroke="#00ffff" strokeWidth="1.5" strokeLinecap="round" filter="url(#akGlow)" />
      <circle cx="18" cy="32.2" r="1.2" fill="#00ffff" filter="url(#akGlow)" />

      {/* Action buttons */}
      <circle cx="28" cy="33" r="2" fill="#fbbf24" filter="url(#akStrongGlow)" />
      <circle cx="28" cy="33" r="1.2" fill="#fde68a" />

      <circle cx="33" cy="34.5" r="1.8" fill="#ff4444" filter="url(#akGlow)" />
      <circle cx="33" cy="34.5" r="1" fill="#ff8888" />

      <circle cx="25" cy="36" r="1.6" fill="#00ff88" filter="url(#akGlow)" opacity="0.85" />
      <circle cx="25" cy="36" r="0.9" fill="#88ffcc" />

      {/* Coin slot */}
      <rect x="20" y="43" width="8" height="1" rx="0.5" fill="#00ffff" opacity="0.5" />

      {/* Side panel accent lines */}
      <line x1="10" y1="12" x2="10" y2="30" stroke="#00ffff" strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="2 2" />
      <line x1="38" y1="12" x2="38" y2="30" stroke="#00ffff" strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="2 2" />

      {/* Corner spark dots */}
      <circle cx="5" cy="5" r="0.9" fill="#00ffff" opacity="0.7" />
      <circle cx="43" cy="5" r="0.7" fill="#fbbf24" opacity="0.6" />
      <circle cx="5" cy="43" r="0.7" fill="#fbbf24" opacity="0.6" />
      <circle cx="43" cy="43" r="0.9" fill="#00ffff" opacity="0.7" />
    </svg>
  );
}

export default function ArcadeKingBadge({ size = 48, showLabel = true }: ArcadeKingBadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,255,0.07) 0%, rgba(251,191,36,0.1) 100%)',
        border: '1px solid rgba(251,191,36,0.5)',
        boxShadow: '0 0 10px rgba(251,191,36,0.3), 0 0 20px rgba(0,255,255,0.1)',
        whiteSpace: 'nowrap',
      }}
      title="Arcade King — 80%+ average on 5+ procedural reflex rounds"
    >
      <ArcadeKingBadgeIcon size={size} />
      {showLabel && (
        <span
          className="font-black tracking-wider"
          style={{
            background: 'linear-gradient(90deg, #00ffff, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '0.6rem',
            filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.6))',
          }}
        >
          ARCADE KING
        </span>
      )}
    </div>
  );
}
