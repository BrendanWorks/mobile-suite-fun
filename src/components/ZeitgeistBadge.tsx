interface ZeitgeistBadgeProps {
  size?: number;
  showLabel?: boolean;
}

export function ZeitgeistBadgeIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter:
          'drop-shadow(0 0 6px rgba(0,255,255,0.8)) drop-shadow(0 0 14px rgba(255,0,255,0.5))',
      }}
    >
      <defs>
        <radialGradient id="zgCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff00ff" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#00ffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ff00ff" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="zgArrowGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00ffff" />
          <stop offset="100%" stopColor="#ff00ff" />
        </linearGradient>

        <linearGradient id="zgVortexA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff00ff" stopOpacity="0.5" />
        </linearGradient>

        <linearGradient id="zgVortexB" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff00ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0.5" />
        </linearGradient>

        <filter id="zgGlow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="zgStrongGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient radial glow */}
      <circle cx="24" cy="24" r="20" fill="url(#zgCoreGlow)" />

      {/* Outer ring */}
      <circle cx="24" cy="24" r="20" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.3" fill="none" strokeDasharray="4 3" />

      {/* Vortex spiral arms — outer */}
      <path
        d="M24 6 C36 6 42 14 40 24 C38 34 28 40 18 36"
        stroke="url(#zgVortexA)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        filter="url(#zgGlow)"
      />
      <path
        d="M24 42 C12 42 6 34 8 24 C10 14 20 8 30 12"
        stroke="url(#zgVortexB)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        filter="url(#zgGlow)"
      />

      {/* Vortex spiral arms — inner */}
      <path
        d="M24 11 C32 10 37 17 35 24 C33 31 25 35 19 32"
        stroke="#00ffff"
        strokeWidth="1"
        fill="none"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />
      <path
        d="M24 37 C16 38 11 31 13 24 C15 17 23 13 29 16"
        stroke="#ff00ff"
        strokeWidth="1"
        fill="none"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />

      {/* Trending arrow — shaft */}
      <line
        x1="12" y1="32"
        x2="33" y2="16"
        stroke="url(#zgArrowGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        filter="url(#zgGlow)"
      />

      {/* Trending arrow — head */}
      <path
        d="M33 16 L26 15 M33 16 L34 23"
        stroke="url(#zgArrowGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#zgGlow)"
      />

      {/* Word fragment sparks */}
      <text x="6" y="18" fontSize="3.8" fill="#00ffff" fillOpacity="0.7" fontFamily="monospace" fontWeight="bold">LOL</text>
      <text x="29" y="38" fontSize="3.5" fill="#ff00ff" fillOpacity="0.7" fontFamily="monospace" fontWeight="bold">OMG</text>
      <text x="7" y="34" fontSize="3" fill="#ff00ff" fillOpacity="0.5" fontFamily="monospace">vibe</text>
      <text x="30" y="13" fontSize="3" fill="#00ffff" fillOpacity="0.5" fontFamily="monospace">pop</text>

      {/* Core pulse dot */}
      <circle
        cx="24" cy="24" r="3"
        fill="#ff00ff"
        opacity="0.9"
        filter="url(#zgStrongGlow)"
      />
      <circle cx="24" cy="24" r="1.5" fill="#ffffff" opacity="0.8" />

      {/* Corner spark dots */}
      <circle cx="5" cy="5" r="0.9" fill="#00ffff" opacity="0.7" />
      <circle cx="43" cy="5" r="0.7" fill="#ff00ff" opacity="0.6" />
      <circle cx="5" cy="43" r="0.7" fill="#ff00ff" opacity="0.6" />
      <circle cx="43" cy="43" r="0.9" fill="#00ffff" opacity="0.7" />
    </svg>
  );
}

export default function ZeitgeistBadge({ size = 48, showLabel = true }: ZeitgeistBadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,255,0.08) 0%, rgba(255,0,255,0.08) 100%)',
        border: '1px solid rgba(255,0,255,0.45)',
        boxShadow: '0 0 10px rgba(255,0,255,0.3), 0 0 20px rgba(0,255,255,0.15)',
        whiteSpace: 'nowrap',
      }}
      title="Zeitgeist — 90%+ on 5+ pop culture & word speed rounds"
    >
      <ZeitgeistBadgeIcon size={size} />
      {showLabel && (
        <span
          className="font-black tracking-wider"
          style={{
            background: 'linear-gradient(90deg, #00ffff, #ff00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '0.6rem',
            filter: 'drop-shadow(0 0 4px rgba(255,0,255,0.6))',
          }}
        >
          ZEITGEIST
        </span>
      )}
    </div>
  );
}
