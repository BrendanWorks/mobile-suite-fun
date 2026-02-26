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
  if (score <= 20) return '★☆☆☆☆';
  if (score <= 40) return '★★☆☆☆';
  if (score <= 60) return '★★★☆☆';
  if (score <= 80) return '★★★★☆';
  return '★★★★★';
}

export const scoringSystem = {
  // OddManOut: 3 puzzles, direct accuracy
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

  // RankAndRoll: Variable items (typically 4 per puzzle), direct accuracy
  rankAndRoll: (correct: number, total: number): GameScore => {
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    return {
      gameId: 'rank-and-roll',
      gameName: 'Ranky',
      rawScore: correct,
      normalizedScore: accuracy,
      grade: getGrade(accuracy),
      breakdown: `${correct}/${total} correct (${Math.round(accuracy)}%)`
    };
  },

  // ShapeSequence: Level 10 = 100
  shapeSequence: (levelReached: number): GameScore => {
    const normalized = Math.min(100, (levelReached / 10) * 100);
    return {
      gameId: 'shape-sequence',
      gameName: 'Simple',
      rawScore: levelReached,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `Reached level ${levelReached}`
    };
  },

  // SplitDecision: 7 items, direct accuracy
  splitDecision: (correct: number, wrong: number): GameScore => {
    const total = correct + wrong;
    if (total === 0) {
      return {
        gameId: 'split-decision',
        gameName: 'Split Decision',
        rawScore: 0,
        normalizedScore: 0,
        grade: '★☆☆☆☆',
        breakdown: 'No items answered'
      };
    }
    const percentage = (correct / total) * 100;
    return {
      gameId: 'split-decision',
      gameName: 'Split Decision',
      rawScore: correct,
      normalizedScore: percentage,
      grade: getGrade(percentage),
      breakdown: `${correct}/${total} correct (${Math.round(percentage)}%)`
    };
  },

  // WordSurge (WordRescue): 500 points = 100
  pop: (wordScore: number): GameScore => {
    const normalized = Math.min(100, (wordScore / 500) * 100);
    return {
      gameId: 'word-rescue',
      gameName: 'WordSurge',
      rawScore: wordScore,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${wordScore} points`
    };
  },

  // Zooma (PhotoMystery): 3 puzzles, direct accuracy
  zooma: (correct: number, total: number = 3): GameScore => {
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    return {
      gameId: 'photo-mystery',
      gameName: 'Zooma',
      rawScore: correct,
      normalizedScore: accuracy,
      grade: getGrade(accuracy),
      breakdown: `${correct}/${total} correct (${Math.round(accuracy)}%)`
    };
  },

  // SnapShot: 40 base + 60 speed bonus
  snapshot: (completed: boolean, timeRemaining: number, totalTime: number = 60): GameScore => {
    let normalized = 0;
    let breakdown = '';

    if (completed) {
      // 40 base points for completion + up to 60 for speed
      const basePoints = 40;
      const speedBonus = (timeRemaining / totalTime) * 60;
      normalized = basePoints + speedBonus;
      breakdown = `Completed with ${Math.round(timeRemaining)}s remaining`;
    } else {
      // Partial credit for progress (up to 40 points max)
      const timeUsed = totalTime - timeRemaining;
      normalized = Math.min(40, (timeUsed / totalTime) * 40);
      breakdown = `Incomplete after ${Math.round(timeUsed)}s`;
    }

    return {
      gameId: 'snapshot',
      gameName: 'SnapShot',
      rawScore: completed ? 100 : 0,
      normalizedScore: Math.min(100, normalized),
      grade: getGrade(Math.min(100, normalized)),
      breakdown
    };
  },

  // Snake: 300 points = 100 (rewards multiple lives) - NO TIME BONUS
  snake: (score: number): GameScore => {
    const normalized = Math.min(100, (score / 300) * 100);
    return {
      gameId: 'snake',
      gameName: 'Snake',
      rawScore: score,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${score} points`
    };
  },

  // Gravity Ball: 1000 altitude = 100 (rewards survival with 3 lives) - NO TIME BONUS
  gravityBall: (altitude: number): GameScore => {
    const normalized = Math.min(100, (altitude / 1000) * 100);
    return {
      gameId: 'gravity-ball',
      gameName: 'Gravity Ball',
      rawScore: altitude,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${altitude}m altitude`
    };
  },

  // Gravity Maze: 5000 points = 100 (level progression + time bonuses) - NO TIME BONUS
  gravityMaze: (score: number, level: number): GameScore => {
    const normalized = Math.min(100, (score / 5000) * 100);
    return {
      gameId: 'gravity-maze',
      gameName: 'Gravity Maze',
      rawScore: score,
      normalizedScore: normalized,
      grade: getGrade(normalized),
      breakdown: `${score} points (Level ${level})`
    };
  },

  // Slope Rider: Soft cap at 100, ~50 at 300, ~75 at 600 - NO TIME BONUS
  slopeRider: (rawScore: number): GameScore => {
    const normalized = Math.atan(rawScore / 300) * (2 / Math.PI) * 100;
    return {
      gameId: 'slope-rider',
      gameName: 'Slope Rider',
      rawScore: rawScore,
      normalizedScore: Math.round(normalized),
      grade: getGrade(Math.round(normalized)),
      breakdown: `Distance and coins: ${rawScore}`
    };
  },

  // Superlative: rawScore/maxScore direct percentage
  superlative: (rawScore: number, maxScore: number): GameScore => {
    const normalized = maxScore > 0 ? Math.min(100, (rawScore / maxScore) * 100) : 0;
    return {
      gameId: 'superlative',
      gameName: 'Superlative',
      rawScore,
      normalizedScore: Math.round(normalized),
      grade: getGrade(Math.round(normalized)),
      breakdown: `${rawScore} / ${maxScore} points`
    };
  },

  // Neural Pulse: 500 exploration points = 100 (levels + steps)
  neuralPulse: (rawScore: number): GameScore => {
    const normalized = Math.min(100, (rawScore / 500) * 100);
    return {
      gameId: 'neural-pulse',
      gameName: 'Neural Pulse',
      rawScore: rawScore,
      normalizedScore: Math.round(normalized),
      grade: getGrade(Math.round(normalized)),
      breakdown: `${rawScore} exploration points`
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
  if (timeRemaining <= 0 || totalDuration <= 0 || normalizedScore <= 0) return 0;

  // Bonus = (Base Score × Time Remaining %) / 2
  const timeRatio = timeRemaining / totalDuration;
  const bonus = (normalizedScore * timeRatio) / 2;

  return Math.round(bonus);
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