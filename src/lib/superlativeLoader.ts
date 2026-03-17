import { supabase } from './supabase'
import type { SuperlativePuzzle } from './types'

export async function loadSuperlativePuzzle(puzzleId: number): Promise<SuperlativePuzzle | null> {
  const { data: puzzle, error: puzzleError } = await supabase
    .from('superlative_puzzles')
    .select('id, game_id, comparison_type, correct_answer, reveal_note, difficulty, is_active')
    .eq('id', puzzleId)
    .maybeSingle()

  if (puzzleError || !puzzle) return null

  const { data: items } = await supabase
    .from('superlative_items')
    .select('id, puzzle_id, role, name, tagline, value, unit')
    .eq('puzzle_id', puzzleId)

  const anchor = items?.find(i => i.role === 'anchor') ?? null
  const challenger = items?.find(i => i.role === 'challenger') ?? null

  return { ...puzzle, anchor, challenger }
}

export async function loadPlaylistSuperlatives(playlistId: number): Promise<SuperlativePuzzle[]> {
  const { data: rounds, error } = await supabase
    .from('playlist_rounds')
    .select('round_number, superlative_puzzle_id')
    .eq('playlist_id', playlistId)
    .not('superlative_puzzle_id', 'is', null)
    .order('id')

  if (error || !rounds || rounds.length === 0) return []

  const puzzleIds = rounds
    .map(r => r.superlative_puzzle_id as number)
    .filter(Boolean)

  const { data: puzzles, error: puzzlesError } = await supabase
    .from('superlative_puzzles')
    .select('id, game_id, comparison_type, correct_answer, reveal_note, difficulty, is_active')
    .in('id', puzzleIds)

  if (puzzlesError || !puzzles) return []

  const { data: items } = await supabase
    .from('superlative_items')
    .select('id, puzzle_id, role, name, tagline, value, unit')
    .in('puzzle_id', puzzleIds)

  return puzzles.map(puzzle => ({
    ...puzzle,
    anchor: items?.find(i => i.puzzle_id === puzzle.id && i.role === 'anchor') ?? null,
    challenger: items?.find(i => i.puzzle_id === puzzle.id && i.role === 'challenger') ?? null,
  }))
}
