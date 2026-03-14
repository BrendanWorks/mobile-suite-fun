interface EagleEyeBadgeProps {
  size?: number;
  showLabel?: boolean;
}

export function EagleEyeBadgeIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter:
          'drop-shadow(0 0 6px rgba(0,255,255,0.9)) drop-shadow(0 0 14px rgba(0,255,255,0.4))',
      }}
    >
      <defs>
        <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.25" />
          <stop offset="60%" stopColor="#0891b2" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0e7490" stopOpacity="0.05" />
        </radialGradient>

        <radialGradient id="pupilGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#001a1a" />
          <stop offset="100%" stopColor="#003333" />
        </radialGradient>

        <radialGradient id="lensFlare" cx="35%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="scanlineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#00ffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0" />
        </linearGradient>

        <clipPath id="eyeClip">
          <path d="M4 24 Q24 6 44 24 Q24 42 4 24 Z" />
        </clipPath>

        <filter id="glowPulse">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="strongGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ambient halo */}
      <ellipse cx="24" cy="24" rx="22" ry="16" fill="rgba(0,255,255,0.04)" />

      {/* Eye white / sclera */}
      <path
        d="M4 24 Q24 6 44 24 Q24 42 4 24 Z"
        fill="url(#irisGrad)"
        stroke="#00ffff"
        strokeWidth="1.2"
        strokeOpacity="0.8"
      />

      {/* Iris ring */}
      <circle
        cx="24"
        cy="24"
        r="9"
        fill="url(#pupilGrad)"
        stroke="#00ffff"
        strokeWidth="1"
        strokeOpacity="0.7"
      />

      {/* Iris texture rings */}
      <circle cx="24" cy="24" r="7" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.3" fill="none" />
      <circle cx="24" cy="24" r="5.5" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.2" fill="none" />

      {/* Pupil */}
      <circle cx="24" cy="24" r="3.8" fill="#000d0d" />

      {/* Pupil inner glow dot */}
      <circle
        cx="24"
        cy="24"
        r="1.5"
        fill="#00ffff"
        opacity="0.9"
        filter="url(#strongGlow)"
      />

      {/* Lens flare highlight */}
      <ellipse cx="20" cy="19" rx="3" ry="1.8" fill="url(#lensFlare)" />

      {/* Scanlines clipped to eye shape */}
      <g clipPath="url(#eyeClip)" opacity="0.6">
        <line x1="4" y1="17" x2="44" y2="17" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.25" />
        <line x1="4" y1="20" x2="44" y2="20" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.2" />
        <line x1="4" y1="23" x2="44" y2="23" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.2" />
        <line x1="4" y1="26" x2="44" y2="26" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.2" />
        <line x1="4" y1="29" x2="44" y2="29" stroke="#00ffff" strokeWidth="0.4" strokeOpacity="0.25" />
        <line x1="4" y1="32" x2="44" y2="32" stroke="#00ffff" strokeWidth="0.3" strokeOpacity="0.15" />
      </g>

      {/* Crosshair — horizontal arms */}
      <line
        x1="2" y1="24"
        x2="12" y2="24"
        stroke="#00ffff"
        strokeWidth="1.2"
        strokeOpacity="0.9"
        filter="url(#glowPulse)"
      />
      <line
        x1="36" y1="24"
        x2="46" y2="24"
        stroke="#00ffff"
        strokeWidth="1.2"
        strokeOpacity="0.9"
        filter="url(#glowPulse)"
      />

      {/* Crosshair — vertical arms */}
      <line
        x1="24" y1="2"
        x2="24" y2="12"
        stroke="#00ffff"
        strokeWidth="1.2"
        strokeOpacity="0.9"
        filter="url(#glowPulse)"
      />
      <line
        x1="24" y1="36"
        x2="24" y2="46"
        stroke="#00ffff"
        strokeWidth="1.2"
        strokeOpacity="0.9"
        filter="url(#glowPulse)"
      />

      {/* Crosshair corner brackets — top-left */}
      <path d="M8 8 L8 14 M8 8 L14 8" stroke="#00ffff" strokeWidth="1.1" strokeOpacity="0.7" fill="none" strokeLinecap="round" />
      {/* top-right */}
      <path d="M40 8 L40 14 M40 8 L34 8" stroke="#00ffff" strokeWidth="1.1" strokeOpacity="0.7" fill="none" strokeLinecap="round" />
      {/* bottom-left */}
      <path d="M8 40 L8 34 M8 40 L14 40" stroke="#00ffff" strokeWidth="1.1" strokeOpacity="0.7" fill="none" strokeLinecap="round" />
      {/* bottom-right */}
      <path d="M40 40 L40 34 M40 40 L34 40" stroke="#00ffff" strokeWidth="1.1" strokeOpacity="0.7" fill="none" strokeLinecap="round" />

      {/* Tick marks on crosshair arms */}
      <line x1="6" y1="22.5" x2="6" y2="25.5" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="9" y1="23" x2="9" y2="25" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />
      <line x1="39" y1="22.5" x2="39" y2="25.5" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="42" y1="23" x2="42" y2="25" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />
      <line x1="22.5" y1="6" x2="25.5" y2="6" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="23" y1="9" x2="25" y2="9" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />
      <line x1="22.5" y1="42" x2="25.5" y2="42" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="23" y1="39" x2="25" y2="39" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.4" />

      {/* Outer eyelid accent lines */}
      <path
        d="M8 20 Q24 10 40 20"
        stroke="#00ffff"
        strokeWidth="0.5"
        strokeOpacity="0.25"
        fill="none"
      />
      <path
        d="M8 28 Q24 38 40 28"
        stroke="#00ffff"
        strokeWidth="0.5"
        strokeOpacity="0.25"
        fill="none"
      />

      {/* Corner spark dots */}
      <circle cx="5" cy="5" r="0.8" fill="#00ffff" opacity="0.6" />
      <circle cx="43" cy="5" r="0.6" fill="#00ffff" opacity="0.5" />
      <circle cx="5" cy="43" r="0.6" fill="#00ffff" opacity="0.5" />
      <circle cx="43" cy="43" r="0.8" fill="#00ffff" opacity="0.6" />
    </svg>
  );
}

export default function EagleEyeBadge({ size = 48, showLabel = true }: EagleEyeBadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded"
      style={{
        background: 'rgba(0,255,255,0.07)',
        border: '1px solid rgba(0,255,255,0.45)',
        boxShadow: '0 0 10px rgba(0,255,255,0.3), inset 0 0 8px rgba(0,255,255,0.05)',
        whiteSpace: 'nowrap',
      }}
      title="Eagle Eye — 85%+ accuracy on 5+ visual & spatial rounds"
    >
      <EagleEyeBadgeIcon size={size} />
      {showLabel && (
        <span
          className="font-black tracking-wider"
          style={{
            color: '#67e8f9',
            fontSize: '0.6rem',
            textShadow: '0 0 6px rgba(0,255,255,0.9)',
          }}
        >
          EAGLE EYE
        </span>
      )}
    </div>
  );
}
