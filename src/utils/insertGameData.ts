import { supabase } from '../lib/supabase';

interface GameItem {
  text: string;
  correctCategory: 'category_1' | 'category_2' | 'both';
  order: number;
}

interface PuzzleData {
  prompt: string;
  emojis?: string;
  correctAnswer: string;
  wrongAnswers: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  category1?: string;
  category2?: string;
  gameType: 'multiple_choice' | 'disordat';
  metadata?: Record<string, any>;
  items?: GameItem[];
}

interface GameData {
  gameName: string;
  gameSlug: string;
  gameDescription: string;
  gameCategory: string;
  puzzles: PuzzleData[];
}

export async function insertSplitDecisionData(gameData: GameData) {
  try {
    console.log('⚡ Starting Split Decision data insertion...');
    
    const gameId = 7; // Fixed game ID for Split Decision
    
    // Step 1: Verify the game exists
    const { data: existingGame, error: gameCheckError } = await supabase
      .from('games')
      .select('id, name')
      .eq('id', gameId)
      .single();
    
    if (gameCheckError) {
      throw new Error(`Game ID ${gameId} not found. Please ensure Split Decision game exists.`);
    }
    
    console.log(`✅ Using existing game: ${existingGame.name} (ID: ${gameId})`);
    
    // Step 2: Insert puzzles for Split Decision
    const results = [];
    
    for (let i = 0; i < gameData.puzzles.length; i++) {
      const puzzle = gameData.puzzles[i];
      console.log(`📝 Processing puzzle ${i + 1}/${gameData.puzzles.length}: ${puzzle.prompt.substring(0, 50)}...`);
      
      if (puzzle.gameType === 'disordat' && puzzle.items && puzzle.items.length > 0) {
        // Handle Split Decision puzzles with items
        const result = await insertSplitDecisionPuzzle(gameId, puzzle);
        results.push(result);
      } else {
        // Handle regular multiple choice puzzles (fallback)
        const result = await insertMultipleChoicePuzzle(gameId, puzzle);
        results.push(result);
      }
    }
    
    console.log('🎉 Split Decision data insertion completed successfully!');
    return {
      success: true,
      gameId,
      puzzleCount: results.length,
      results
    };
    
  } catch (error) {
    console.error('❌ Error inserting Split Decision data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function insertSplitDecisionPuzzle(gameId: number, puzzle: PuzzleData) {
  try {
    // Insert the main puzzle record
    const { data: puzzleRecord, error: puzzleError } = await supabase
      .from('puzzles')
      .insert({
        game_id: gameId,
        prompt: puzzle.prompt,
        emojis: puzzle.emojis || null,
        correct_answer: puzzle.correctAnswer,
        wrong_answers: puzzle.wrongAnswers,
        difficulty: puzzle.difficulty,
        category_1: puzzle.category1 || null,
        category_2: puzzle.category2 || null,
        game_type: 'disordat',
        metadata: puzzle.metadata || null
      })
      .select('id')
      .single();
    
    if (puzzleError) throw puzzleError;
    
    const puzzleId = puzzleRecord.id;
    console.log(`  ✅ Created puzzle record (ID: ${puzzleId})`);
    
    // Insert puzzle items if they exist
    if (puzzle.items && puzzle.items.length > 0) {
      const itemsToInsert = puzzle.items.map(item => ({
        puzzle_id: puzzleId,
        item_text: item.text,
        correct_category: item.correctCategory,
        item_order: item.order
      }));
      
      const { error: itemsError } = await supabase
        .from('puzzle_items')
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;
      
      console.log(`  ✅ Inserted ${puzzle.items.length} puzzle items`);
    }
    
    return {
      puzzleId,
      itemCount: puzzle.items?.length || 0,
      success: true
    };
    
  } catch (error) {
    console.error(`  ❌ Error inserting puzzle: ${error.message}`);
    throw error;
  }
}

async function insertMultipleChoicePuzzle(gameId: number, puzzle: PuzzleData) {
  try {
    // Insert regular multiple choice puzzle
    const { data: puzzleRecord, error: puzzleError } = await supabase
      .from('puzzles')
      .insert({
        game_id: gameId,
        prompt: puzzle.prompt,
        emojis: puzzle.emojis || null,
        correct_answer: puzzle.correctAnswer,
        wrong_answers: puzzle.wrongAnswers,
        difficulty: puzzle.difficulty,
        category_1: puzzle.category1 || null,
        category_2: puzzle.category2 || null,
        game_type: 'multiple_choice',
        metadata: puzzle.metadata || null
      })
      .select('id')
      .single();
    
    if (puzzleError) throw puzzleError;
    
    console.log(`  ✅ Created multiple choice puzzle (ID: ${puzzleRecord.id})`);
    
    return {
      puzzleId: puzzleRecord.id,
      success: true
    };
    
  } catch (error) {
    console.error(`  ❌ Error inserting multiple choice puzzle: ${error.message}`);
    throw error;
  }
}

// Example usage function
export async function insertExampleSplitDecisionData() {
  const exampleData: GameData = {
    gameName: "Split Decision Example",
    gameSlug: "split-decision-example",
    gameDescription: "Example Split Decision puzzles",
    gameCategory: "Puzzle",
    puzzles: [
      {
        prompt: "Shakespeare character or U.S. Supreme Court Justice?",
        correctAnswer: "Category Classification",
        wrongAnswers: [],
        difficulty: "medium",
        category1: "Shakespeare character",
        category2: "U.S. Supreme Court Justice",
        gameType: "disordat",
        metadata: {
          timing: { itemDurationMs: 3000, introMs: 1000, recapMs: 1200 },
          scoring: { correct: 300, wrong: -300, timeout: 0 }
        },
        items: [
          { text: "Portia", correctCategory: "category_1", order: 1 },
          { text: "Roberts", correctCategory: "category_2", order: 2 },
          { text: "Othello", correctCategory: "category_1", order: 3 },
          { text: "Sotomayor", correctCategory: "category_2", order: 4 },
          { text: "Falstaff", correctCategory: "category_1", order: 5 },
          { text: "Marshall", correctCategory: "category_2", order: 6 },
          { text: "Story", correctCategory: "category_2", order: 7 }
        ]
      }
    ]
  };
  
  return await insertSplitDecisionData(exampleData);
}

// Utility to clear existing Split Decision puzzles (use with caution!)
export async function clearSplitDecisionPuzzles() {
  try {
    console.log('🗑️ Clearing existing Split Decision puzzles...');
    
    const { error } = await supabase
      .from('puzzles')
      .delete()
      .eq('game_id', 7);
    
    if (error) throw error;
    
    console.log('✅ Split Decision puzzles cleared');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error clearing puzzles:', error);
    return { success: false, error: error.message };
  }
}