import type { SuperlativeItem } from '../lib/types'

type CardState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

interface Props {
  item: SuperlativeItem
  state: CardState
  onClick: () => void
}

const STATE_STYLES: Record<CardState, { border: string; bg: string; shadow: string }> = {
  idle:     { border: '#22d3ee33', bg: 'rgba(0,0,0,0.5)',        shadow: '0 0 10px rgba(0,255,255,0.15)' },
  selected: { border: '#22d3ee',   bg: 'rgba(34,211,238,0.15)',  shadow: '0 0 18px rgba(0,255,255,0.4)' },
  correct:  { border: '#22c55e',   bg: 'rgba(34,197,94,0.15)',   shadow: '0 0 25px rgba(34,197,94,0.6)' },
  wrong:    { border: '#ef4444',   bg: 'rgba(239,68,68,0.15)',   shadow: '0 0 20px rgba(239,68,68,0.5)' },
  dimmed:   { border: '#22d3ee18', bg: 'rgba(0,0,0,0.2)',        shadow: 'none' },
}

export default function OptionCard({ item, state, onClick }: Props) {
  const styles = STATE_STYLES[state]
  const disabled = state !== 'idle' && state !== 'selected'

  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return null
    const num = value >= 1000 ? value.toLocaleString() : value
    return `${num}${unit ? ` ${unit}` : ''}`
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="relative w-full rounded-2xl border-2 p-5 text-center transition-all duration-200 active:scale-95"
      style={{
        borderColor: styles.border,
        background: styles.bg,
        boxShadow: styles.shadow,
        cursor: disabled ? 'default' : 'pointer',
        opacity: state === 'dimmed' ? 0.4 : 1,
      }}
    >
      {state === 'correct' && (
        <span
          className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-black font-bold text-sm"
          style={{ boxShadow: '0 0 12px rgba(34,197,94,0.8)' }}
        >
          ✓
        </span>
      )}
      {state === 'wrong' && (
        <span
          className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-black font-bold text-sm"
          style={{ boxShadow: '0 0 12px rgba(239,68,68,0.8)' }}
        >
          ✗
        </span>
      )}

      <p
        className="text-white font-bold text-base leading-snug mb-1"
        style={{ textShadow: '0 0 8px rgba(255,255,255,0.25)' }}
      >
        {item.name}
      </p>

      {item.tagline && (
        <p className="text-cyan-400/60 text-xs italic leading-snug mb-1">{item.tagline}</p>
      )}

      {item.value !== null && (
        <p
          className="text-cyan-300 font-black text-sm mt-1"
          style={{ textShadow: '0 0 6px rgba(0,255,255,0.4)' }}
        >
          {formatValue(item.value, item.unit)}
        </p>
      )}
    </button>
  )
}
