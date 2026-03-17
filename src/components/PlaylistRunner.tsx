import { useState, useEffect } from 'react'
import { loadPlaylistSuperlatives } from '../lib/superlativeLoader'
import type { SuperlativePuzzle } from '../lib/types'
import Superlative from './Superlative'

interface Props {
  playlistId: number
  onExit: () => void
}

type RunnerState = 'loading' | 'playing' | 'between' | 'summary'

interface RoundResult {
  puzzle: SuperlativePuzzle
  score: number
  maxScore: number
}

export default function PlaylistRunner({ playlistId, onExit }: Props) {
  const [runnerState, setRunnerState] = useState<RunnerState>('loading')
  const [puzzles, setPuzzles] = useState<SuperlativePuzzle[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])
  const [lastResult, setLastResult] = useState<RoundResult | null>(null)

  useEffect(() => {
    loadPlaylistSuperlatives(playlistId).then(loaded => {
      if (loaded.length === 0) {
        onExit()
        return
      }
      setPuzzles(loaded)
      setRunnerState('playing')
    })
  }, [playlistId, onExit])

  const handleRoundComplete = (score: number, maxScore: number) => {
    const result: RoundResult = { puzzle: puzzles[currentIndex], score, maxScore }
    setLastResult(result)
    setResults(prev => [...prev, result])
    setRunnerState('between')
  }

  const handleNext = () => {
    if (currentIndex + 1 >= puzzles.length) {
      setRunnerState('summary')
    } else {
      setCurrentIndex(i => i + 1)
      setRunnerState('playing')
    }
  }

  if (runnerState === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-cyan-400 text-lg" style={{ textShadow: '0 0 10px #00ffff' }}>
          Loading playlist...
        </p>
      </div>
    )
  }

  if (runnerState === 'summary') {
    const totalScore = results.reduce((s, r) => s + r.score, 0)
    const totalMax = results.reduce((s, r) => s + r.maxScore, 0)
    const correct = results.filter(r => r.score > 0).length

    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-start p-4 pt-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <p className="text-cyan-400/50 text-xs tracking-widest uppercase mb-1">Playlist 51 Complete</p>
            <h2
              className="text-white font-black text-3xl mb-1"
              style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
            >
              {correct}/{results.length} Correct
            </h2>
            <p
              className="text-yellow-400 text-5xl font-black"
              style={{ textShadow: '0 0 20px #fbbf24' }}
            >
              {totalScore.toLocaleString()}
            </p>
            <p className="text-white/30 text-xs mt-1">of {totalMax.toLocaleString()} possible</p>
          </div>

          <div className="space-y-2 mb-6">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 border"
                style={{
                  borderColor: r.score > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                  background: r.score > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                }}
              >
                <span className={r.score > 0 ? 'text-green-400' : 'text-red-400'}>
                  {r.score > 0 ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">
                    #{i + 1} — {r.puzzle.comparison_type}
                  </p>
                  <p className="text-white/40 text-xs truncate">
                    {r.puzzle.correct_answer}
                  </p>
                </div>
                <span className={`text-xs font-bold ${r.score > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.score} pts
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onExit}
            className="w-full py-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-95"
            style={{
              borderColor: '#22d3ee',
              color: '#22d3ee',
              background: 'transparent',
              textShadow: '0 0 8px #22d3ee',
              boxShadow: '0 0 15px rgba(34,211,238,0.2)',
            }}
          >
            Back to Debug Menu
          </button>
        </div>
      </div>
    )
  }

  if (runnerState === 'between' && lastResult) {
    const isCorrect = lastResult.score > 0
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <p
            className={`font-black text-5xl mb-3 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}
            style={{ textShadow: isCorrect ? '0 0 20px #22c55e' : '0 0 20px #ef4444' }}
          >
            {isCorrect ? 'Correct!' : 'Wrong'}
          </p>
          <p className="text-white/50 text-sm mb-1">
            Puzzle {currentIndex + 1} of {puzzles.length}
          </p>
          <p className="text-cyan-300 text-xs mb-8 px-4 leading-relaxed">
            {lastResult.puzzle.reveal_note}
          </p>

          <div className="flex gap-4 mb-4">
            <div className="flex-1 rounded-xl border border-white/10 py-3 px-4">
              <p className="text-white/40 text-xs mb-0.5">Correct answer</p>
              <p className="text-white font-bold text-sm">{lastResult.puzzle.correct_answer}</p>
            </div>
            <div className="flex-1 rounded-xl border border-white/10 py-3 px-4">
              <p className="text-white/40 text-xs mb-0.5">Score</p>
              <p className={`font-bold text-sm ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                +{lastResult.score} pts
              </p>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full py-3.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95"
            style={{
              borderColor: '#ec4899',
              color: '#f472b6',
              background: 'transparent',
              textShadow: '0 0 8px #ec4899',
              boxShadow: '0 0 15px rgba(236,72,153,0.25)',
            }}
          >
            {currentIndex + 1 >= puzzles.length ? 'See Results' : 'Next →'}
          </button>
        </div>
      </div>
    )
  }

  if (runnerState === 'playing' && puzzles[currentIndex]) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(34,211,238,0.1)' }}
        >
          <button
            onClick={onExit}
            className="text-white/40 text-xs hover:text-white/70 transition-colors"
          >
            ✕ Exit
          </button>
          <p className="text-white/50 text-xs">
            {currentIndex + 1} / {puzzles.length}
          </p>
          <div className="flex gap-1">
            {puzzles.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  background: i < currentIndex
                    ? '#22c55e'
                    : i === currentIndex
                      ? '#22d3ee'
                      : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Game */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
          <Superlative
            key={puzzles[currentIndex].id}
            puzzleId={puzzles[currentIndex].id}
            onComplete={handleRoundComplete}
          />
        </div>
      </div>
    )
  }

  return null
}
