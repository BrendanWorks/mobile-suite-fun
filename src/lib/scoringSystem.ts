/**
 * Unified Scoring System for Game Box
 * Copy this entire file into your lib/ folder as: lib/scoringSystem.ts
 */

export interface GameScore {
  gameId: string;
  gameName: string;
  rawScore: number;
  normalizedScore: number;
  grade: string;
  breakdown: string;
  timeBonus?: number;
  totalWithBonus?: number;
}

export interface SessionScore {
  totalScore: number;
  maxPossible: number;
  percentage: number;
}

function getGrade(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export const scoringSystem = {
  // OddManOut: Accuracy-based
  oddManOut: (correct: number, total: number): GameScore => {
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    return {
      gameId: 'odd-man-out',
      gameName: 'Odd Man Out',
      rawScore: correct,
      normalizedScore: accuracy,
      grade: getGrade(accuracy),
      breakdown: `${correct}/${total} correct (${Math.round(accuracy)}%)`
    };
  },

  // RankAndRoll: Component-based
  rankAndRoll: (baseScore: number): GameScore => {
    const normalized = Math.min(100, (baseScore / 500) * 100);
    return {
      gameId: 'rank-and-roll',
      gameName: 'Ranky',
      rawScore: baseScore,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${Math.round(baseScore)} base points`
    };
  },

  // ShapeSequence: Level-based
  shapeSequence: (levelReached: number): GameScore => {
    const normalized = Math.min(100, (levelReached / 10) * 100);
    return {
      gameId: 'shape-sequence',
      gameName: 'Shape Sequence',
      rawScore: levelReached,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `Reached level ${levelReached}`
    };
  },

  // SplitDecision: Binary scoring
  splitDecision: (correct: number, wrong: number): GameScore => {
    const total = correct + wrong;
    if (total === 0) {
      return {
        gameId: 'split-decision',
        gameName: 'Split Decision',
        rawScore: 0,
        normalizedScore: 0,
        grade: 'D',
        breakdown: 'No items answered'
      };
    }
    const percentage = (correct / total) * 100;
    return {
      gameId: 'split-decision',
      gameName: 'Split Decision',
      rawScore: correct - wrong,
      normalizedScore: percentage,
      grade: getGrade(percentage),
      breakdown: `${correct}/${total} correct (${Math.round(percentage)}%)`
    };
  },

  // Pop (WordRescue): Length-squared
  pop: (wordScore: number): GameScore => {
    const normalized = Math.min(100, (wordScore / 1500) * 100);
    return {
      gameId: 'word-rescue',
      gameName: 'Pop',
      rawScore: wordScore,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${wordScore} points`
    };
  },

  // Zooma (PhotoMystery): Time-based
  zooma: (score: number): GameScore => {
    const normalized = Math.min(100, (score / 1000) * 100);
    return {
      gameId: 'photo-mystery',
      gameName: 'Zooma',
      rawScore: score,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${score} points`
    };
  },

  // Dalmatian: Time-based completion
  dalmatian: (completed: boolean, timeRemaining: number, totalTime: number = 60): GameScore => {
    let normalized = 0;
    let breakdown = '';

    if (completed) {
      normalized = 50 + ((timeRemaining / totalTime) * 50);
      breakdown = `Completed with ${timeRemaining}s remaining`;
    } else {
      normalized = (((totalTime - timeRemaining) / totalTime) * 50);
      breakdown = `Incomplete after ${totalTime - timeRemaining}s`;
    }

    return {
      gameId: 'dalmatian-puzzle',
      gameName: 'Dalmatian Puzzle',
      rawScore: completed ? 100 : Math.round(normalized),
      normalizedScore: Math.min(100, normalized),
      grade: getGrade(Math.min(100, normalized)),
      breakdown
    };
  },

  // EmojiMaster: Placeholder (adjust based on actual game)
  emojiMaster: (correct: number, total: number): GameScore => {
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    return {
      gameId: 'emoji-master',
      gameName: 'Emoji Master',
      rawScore: correct,
      normalizedScore: accuracy,
      grade: getGrade(accuracy),
      breakdown: `${correct}/${total} correct (${Math.round(accuracy)}%)`
    };
  },

  // Snake: Score-based
  snake: (score: number): GameScore => {
    const normalized = Math.min(100, (score / 200) * 100);
    return {
      gameId: 'snake',
      gameName: 'Snake',
      rawScore: score,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${score} points`
    };
  }
};

export const calculateSessionScore = (gameScores: GameScore[]): SessionScore => {
  const total = gameScores.reduce((sum, g) => sum + g.normalizedScore, 0);
  const maxPossible = gameScores.length * 100;
  const percentage = (total / maxPossible) * 100;

  return {
    totalScore: Math.round(total),
    maxPossible,
    percentage: Math.round(percentage)
  };
};

export const getSessionGrade = (percentage: number): string => {
  return getGrade(percentage);
};

export const calculateTimeBonus = (
  normalizedScore: number,
  timeRemaining: number,
  totalDuration: number
): number => {
  if (timeRemaining <= 0 || totalDuration <= 0) return 0;

  const maxBonus = normalizedScore * 0.5;
  const timeRatio = timeRemaining / totalDuration;

  return Math.round(maxBonus * timeRatio);
};

export const applyTimeBonus = (
  gameScore: GameScore,
  timeRemaining: number,
  totalDuration: number
): GameScore => {
  const timeBonus = calculateTimeBonus(gameScore.normalizedScore, timeRemaining, totalDuration);
  const totalWithBonus = gameScore.normalizedScore + timeBonus;

  return {
    ...gameScore,
    timeBonus,
    totalWithBonus,
    grade: getGrade(totalWithBonus)
  };
};
