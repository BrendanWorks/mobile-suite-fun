export interface SuperlativeItem {
  id: number
  puzzle_id: number
  role: 'anchor' | 'challenger'
  name: string
  tagline: string | null
  value: number | null
  unit: string | null
}

export interface SuperlativePuzzle {
  id: number
  game_id: number
  comparison_type: string
  correct_answer: string
  reveal_note: string | null
  difficulty: string | null
  is_active: boolean
  anchor: SuperlativeItem | null
  challenger: SuperlativeItem | null
}
