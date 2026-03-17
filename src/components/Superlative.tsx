import { useState, useEffect, useCallback, useRef } from 'react'
import { loadSuperlativePuzzle } from '../lib/superlativeLoader'
import type { SuperlativePuzzle } from '../lib/types'
import OptionCard from './OptionCard'

const MAX_SCORE = 250
const ROUND_DURATION_S = 30
const REVEAL_DELAY_MS = 1800

interface Props {
  puzzleId: number
  onComplete: (score: number, maxScore: number) => void
  onScoreUpdate?: (score: number, maxScore: number) => void
}

type GameState = 'loading' | 'playing' | 'revealing' | 'timeout' | 'complete'

export default function Superlative({ puzzleId, onComplete, onScoreUpdate }: Props) {
  const [puzzle, setPuzzle] = useState<SuperlativePuzzle | null>(null)
  const [gameState, setGameState] = useState<GameState>('loading')
  const [selected, setSelected] = useState<'anchor' | 'challenger' | null>(null)
  const [, setScore] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION_S)

  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const finish = useCallback((finalScore: number) => {
    if (completedRef.current) return
    completedRef.current = true
    stopTimer()
    setGameState('complete')
    onCompleteRef.current(finalScore, MAX_SCORE)
  }, [stopTimer])

  useEffect(() => {
    completedRef.current = false
    setGameState('loading')
    setSelected(null)
    setScore(0)
    setSecondsLeft(ROUND_DURATION_S)
    stopTimer()

    loadSuperlativePuzzle(puzzleId).then(p => {
      if (!p || !p.anchor || !p.challenger) {
        finish(0)
        return
      }
      setPuzzle(p)
      setGameState('playing')
    })
  }, [puzzleId, stopTimer, finish])

  useEffect(() => {
    if (gameState !== 'playing') { stopTimer(); return }
    if (timerRef.current) return

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          stopTimer()
          setGameState('timeout')
          setTimeout(() => finish(0), 2500)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return stopTimer
  }, [gameState, stopTimer, finish])

  const handlePick = useCallback((role: 'anchor' | 'challenger') => {
    if (!puzzle || gameState !== 'playing') return

    stopTimer()
    setSelected(role)
    setGameState('revealing')

    const item = role === 'anchor' ? puzzle.anchor : puzzle.challenger
    const isCorrect = item?.name === puzzle.correct_answer
    const earned = isCorrect ? MAX_SCORE : 0

    setScore(earned)
    onScoreUpdate?.(earned, MAX_SCORE)

    setTimeout(() => finish(earned), REVEAL_DELAY_MS)
  }, [puzzle, gameState, stopTimer, finish, onScoreUpdate])

  const isDanger = secondsLeft <= 8
  const progress = (secondsLeft / ROUND_DURATION_S) * 100

  if (gameState === 'loading' || !puzzle?.anchor || !puzzle?.challenger) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <p className="text-cyan-400 text-lg" style={{ textShadow: '0 0 10px #00ffff' }}>
          Loading...
        </p>
      </div>
    )
  }

  const anchorState = (() => {
    if (gameState === 'playing') return selected === 'anchor' ? 'selected' : 'idle'
    if (gameState === 'revealing') {
      const isCorrect = puzzle.anchor.name === puzzle.correct_answer
      if (selected === 'anchor') return isCorrect ? 'correct' : 'wrong'
      return isCorrect ? 'correct' : 'dimmed'
    }
    return 'idle'
  })()

  const challengerState = (() => {
    if (gameState === 'playing') return selected === 'challenger' ? 'selected' : 'idle'
    if (gameState === 'revealing') {
      const isCorrect = puzzle.challenger.name === puzzle.correct_answer
      if (selected === 'challenger') return isCorrect ? 'correct' : 'wrong'
      return isCorrect ? 'correct' : 'dimmed'
    }
    return 'idle'
  })()

  return (
    <div className="h-full bg-black flex flex-col items-center justify-start p-4 pt-2 overflow-y-auto">
      <div className="w-full max-w-sm">

        {/* Timer bar */}
        <div
          className="w-full h-1.5 rounded-full overflow-hidden mb-3 border"
          style={{
            borderColor: isDanger ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.4)',
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${progress}%`,
              background: isDanger ? '#f87171' : '#22d3ee',
              boxShadow: isDanger ? '0 0 8px #f87171' : '0 0 8px #00ffff',
            }}
          />
        </div>

        {/* Question */}
        <div className="text-center mb-5">
          <p className="text-white/50 text-xs tracking-widest uppercase mb-1">
            {puzzle.comparison_type}
          </p>
          <p
            className="text-white font-black leading-tight"
            style={{
              fontSize: 'clamp(1.6rem, 9vw, 2.8rem)',
              textShadow: '0 0 20px rgba(0,255,255,0.5), 0 0 40px rgba(0,255,255,0.2)',
              letterSpacing: '-0.02em',
            }}
          >
            Which is {puzzle.comparison_type.toLowerCase()}?
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 mb-4">
          <OptionCard
            item={puzzle.anchor}
            state={anchorState as any}
            onClick={() => handlePick('anchor')}
          />

          <p
            className="text-center text-cyan-400/30 font-black text-xs tracking-widest"
            style={{ letterSpacing: '0.35em' }}
          >
            VS
          </p>

          <OptionCard
            item={puzzle.challenger}
            state={challengerState as any}
            onClick={() => handlePick('challenger')}
          />
        </div>

        {/* Reveal / timeout info box */}
        <div
          className="rounded-xl border-2 px-4 py-3 min-h-16 flex items-center justify-center transition-all duration-300"
          style={{
            borderColor: gameState === 'timeout'
              ? 'rgba(239,68,68,0.5)'
              : gameState === 'revealing'
                ? 'rgba(34,211,238,0.4)'
                : 'rgba(34,211,238,0.1)',
            background: 'rgba(0,0,0,0.7)',
            boxShadow: gameState === 'revealing' ? '0 0 20px rgba(0,255,255,0.15)' : 'none',
          }}
        >
          {gameState === 'timeout' ? (
            <p
              className="text-red-400 font-black text-2xl animate-pulse"
              style={{ textShadow: '0 0 20px #f87171' }}
            >
              Time's Up!
            </p>
          ) : gameState === 'revealing' && puzzle.reveal_note ? (
            <p className="text-cyan-300 text-xs leading-relaxed text-center">
              {puzzle.reveal_note}
            </p>
          ) : (
            <p
              className="text-cyan-400/20 font-black text-2xl"
              style={{ letterSpacing: '-0.02em' }}
            >
              Pick one
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
