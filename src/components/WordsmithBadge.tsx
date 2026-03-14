interface WordsmithBadgeProps {
  size?: number;
  showLabel?: boolean;
}

export function WordsmithBadgeIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,255,0.7)) drop-shadow(0 0 16px rgba(251,191,36,0.4))' }}
    >
      <defs>
        <radialGradient id="bookGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#164e63" />
        </linearGradient>

        <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.8" />
        </linearGradient>

        <linearGradient id="quillGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="60%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fffbeb" />
        </linearGradient>

        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background radial glow */}
      <ellipse cx="24" cy="28" rx="18" ry="12" fill="url(#bookGlow)" />

      {/* Open book - right page */}
      <path
        d="M24 12 Q36 11 38 13 L38 38 Q36 37 24 38 Z"
        fill="url(#coverGrad)"
        stroke="#00ffff"
        strokeWidth="0.8"
        strokeOpacity="0.7"
      />

      {/* Open book - left page */}
      <path
        d="M24 12 Q12 11 10 13 L10 38 Q12 37 24 38 Z"
        fill="url(#coverGrad)"
        stroke="#00ffff"
        strokeWidth="0.8"
        strokeOpacity="0.7"
      />

      {/* Book spine / center crease */}
      <line
        x1="24" y1="12"
        x2="24" y2="38"
        stroke="url(#spineGrad)"
        strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 0 3px #00ffff)' }}
      />

      {/* Right page lines */}
      <line x1="27" y1="19" x2="36" y2="19" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.45" />
      <line x1="27" y1="22" x2="36" y2="22" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.35" />
      <line x1="27" y1="25" x2="36" y2="25" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.35" />
      <line x1="27" y1="28" x2="34" y2="28" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.25" />

      {/* Left page lines */}
      <line x1="12" y1="19" x2="21" y2="19" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.45" />
      <line x1="12" y1="22" x2="21" y2="22" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.35" />
      <line x1="12" y1="25" x2="21" y2="25" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.35" />
      <line x1="14" y1="28" x2="21" y2="28" stroke="#00ffff" strokeWidth="0.6" strokeOpacity="0.25" />

      {/* Quill feather - shaft */}
      <path
        d="M30 8 Q26 14 22 32 Q25 24 32 10 Z"
        fill="url(#quillGrad)"
        filter="url(#glow)"
      />

      {/* Quill feather - left barbs */}
      <path
        d="M27.5 11 Q23 16 21 22"
        stroke="#fde68a"
        strokeWidth="0.7"
        strokeOpacity="0.6"
        fill="none"
      />
      <path
        d="M26 14 Q22 18 21 24"
        stroke="#fde68a"
        strokeWidth="0.6"
        strokeOpacity="0.5"
        fill="none"
      />
      <path
        d="M24.5 17 Q22 20 21.5 25"
        stroke="#fde68a"
        strokeWidth="0.5"
        strokeOpacity="0.4"
        fill="none"
      />

      {/* Quill tip / nib */}
      <path
        d="M22 32 L21.2 35.5 L22.8 33.5 Z"
        fill="#fbbf24"
        filter="url(#glow)"
      />

      {/* Ink drop from nib */}
      <circle cx="21.5" cy="36.5" r="0.9" fill="#00ffff" opacity="0.9"
        style={{ filter: 'drop-shadow(0 0 4px #00ffff)' }}
      />

      {/* Corner accent star sparks */}
      <circle cx="8" cy="9" r="0.7" fill="#fbbf24" opacity="0.8" />
      <circle cx="40" cy="9" r="0.5" fill="#00ffff" opacity="0.7" />
      <circle cx="6" cy="17" r="0.5" fill="#00ffff" opacity="0.5" />
      <circle cx="42" cy="22" r="0.6" fill="#fbbf24" opacity="0.6" />

      {/* Outer border ring */}
      <rect
        x="3" y="5"
        width="42" height="38"
        rx="4"
        stroke="#00ffff"
        strokeWidth="0.8"
        strokeOpacity="0.3"
        fill="none"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

export default function WordsmithBadge({ size = 48, showLabel = true }: WordsmithBadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,255,0.08) 0%, rgba(251,191,36,0.08) 100%)',
        border: '1px solid rgba(0,255,255,0.4)',
        boxShadow: '0 0 10px rgba(0,255,255,0.25), 0 0 20px rgba(251,191,36,0.1)',
        whiteSpace: 'nowrap',
      }}
      title="Wordsmith — 90%+ on 5+ text & trivia rounds"
    >
      <WordsmithBadgeIcon size={size} />
      {showLabel && (
        <span
          className="text-xs font-black tracking-wider"
          style={{
            color: '#67e8f9',
            fontSize: '0.6rem',
            textShadow: '0 0 6px rgba(0,255,255,0.8)',
          }}
        >
          WORDSMITH
        </span>
      )}
    </div>
  );
}
