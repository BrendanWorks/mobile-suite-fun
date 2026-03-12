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
  perfectScoreBonus?: number;
  isBonusApplied?: boolean;
}

export interface SessionScore {
  totalScore: number;
  maxPossible: number;
  percentage: number;
}

const SCORE_LABELS = [
  "Didn't Even Try!", // 0
  "Poor!", // 1
  "Whoa There!", // 2
  "Weak Sauce!", // 3
  "Seriously Struggling!", // 4
  "Not Even Close!", // 5
  "Harsh!", // 6
  "Geez!", // 7
  "Major Issues!", // 8
  "Fumbled It!", // 9
  "Ouch!", // 10
  "Yikes!", // 11
  "Rough One!", // 12
  "Better Luck Next Time!", // 13
  "That Stung!", // 14
  "Oof!", // 15
  "Tough Round!", // 16
  "Swing and a Miss!", // 17
  "Close, but Not Quite!", // 18
  "Need Some Work!", // 19
  "Keep Trying!", // 20
  "Don't Give Up!", // 21
  "You're Learning!", // 22
  "Push Harder!", // 23
  "More Work Needed!", // 24
  "Stay Focused!", // 25
  "Keep At It!", // 26
  "Progress Pending!", // 27
  "Effort Encouraged!", // 28
  "Persistence Pays!", // 29
  "Needs Improvement!", // 30
  "Keep Building!", // 31
  "Getting Better!", // 32
  "More Practice Needed!", // 33
  "Room to Grow!", // 34
  "Working Toward Better!", // 35
  "Try Again!", // 36
  "Still Learning!", // 37
  "Room for Growth!", // 38
  "Progress Coming!", // 39
  "Pretty Good!", // 40
  "Getting There!", // 41
  "Making Headway!", // 42
  "Solid Attempt!", // 43
  "Worth the Effort!", // 44
  "Decent Effort!", // 45
  "Stepping Up!", // 46
  "Fair Attempt!", // 47
  "Commendable Try!", // 48
  "On the Right Track!", // 49
  "Above Average!", // 50
  "Getting Stronger!", // 51
  "Meh", // 52
  "Moving Right Along!", // 53
  "Making Progress!", // 54
  "Steady Improvement!", // 55
  "Gaining Ground!", // 56
  "Fair Performance!", // 57
  "Building Momentum!", // 58
  "Acceptable Work!", // 59
  "Well Done!", // 60
  "Nice Work!", // 61
  "Good Effort!", // 62
  "Solid Performance!", // 63
  "Respectable Job!", // 64
  "Decently Done!", // 65
  "Good Show!", // 66
  "Fair Play!", // 67
  "Noteworthy Work!", // 68
  "Credible Effort!", // 69
  "Very Good!", // 70
  "Nicely Done!", // 71
  "Solidly Strong!", // 72
  "Well Executed!", // 73
  "Quite Impressive!", // 74
  "Really Nice Work!", // 75
  "Solid Effort!", // 76
  "Respectably Good!", // 77
  "Genuinely Good!", // 78
  "Competently Excellent!", // 79
  "Exceptional!", // 80
  "Remarkably Solid!", // 81
  "Truly Impressive!", // 82
  "Powerful!", // 83
  "Notably Excellent!", // 84
  "That Did Not Suck!", // 85
  "Seriously Stellar!", // 86
  "Distinctly Great!", // 87
  "Magnificently Done!", // 88
  "Impressively Excellent!", // 89
  "Amazeballs!", // 90
  "Absolutely Blazing!", // 91
  "Grace Hopper Grade!", // 92
  "Epic!", // 93
  "Ate and Left No Crumbs!", // 94
  "Wildly Incredible!", // 95
  "Great Work, Einstein!", // 96
  "Outrageously Brilliant!", // 97
  "Most Excellent!", // 98
  "Spectacularly Crushing It!", // 99
  "Perfect!" // 100
];

function getGrade(score: number): string {
  if (score <= 20) return '★☆☆☆☆';
  if (score <= 40) return '★★☆☆☆';
  if (score <= 60) return '★★★☆☆';
  if (score <= 80) return '★★★★☆';
  return '★★★★★';
}

export function getScoreLabel(score: number): string {
  const roundedScore = Math.round(Math.min(100, Math.max(0, score)));
  return SCORE_LABELS[roundedScore];
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
  },

  // ColorClash: 3000 points = 100 (rawScore/maxScore direct percentage)
  colorClash: (rawScore: number, maxScore: number): GameScore => {
    const normalized = maxScore > 0 ? Math.min(100, (rawScore / maxScore) * 100) : 0;
    return {
      gameId: 'color-clash',
      gameName: 'ColorClash',
      rawScore,
      normalizedScore: Math.round(normalized),
      grade: getGrade(Math.round(normalized)),
      breakdown: `${rawScore} / ${maxScore} points`
    };
  },

  // Recall: rawScore/maxScore direct percentage
  recall: (rawScore: number, maxScore: number): GameScore => {
    const normalized = maxScore > 0 ? Math.min(100, (rawScore / maxScore) * 100) : 0;
    return {
      gameId: 'recall',
      gameName: 'Recall',
      rawScore,
      normalizedScore: Math.round(normalized),
      grade: getGrade(Math.round(normalized)),
      breakdown: `${rawScore} / ${maxScore} points`
    };
  }
};

export const calculateSessionScore = (gameScores: GameScore[]): SessionScore => {
  const total = gameScores.reduce((sum, g) => sum + (g.totalWithBonus || g.normalizedScore), 0);
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

const CONTENT_PUZZLE_GAMES = [
  'odd-man-out',
  'rank-and-roll',
  'photo-mystery',
  'snapshot',
  'snap-shot',
  'split-decision',
  'fake-out',
  'hive-mind',
  'double-fake',
  'superlative',
  'true-false',
  'multiple-choice',
];

export const applyPerfectScoreBonus = (
  gameScore: GameScore
): GameScore => {
  // Exclude procedural games from getting perfect bonus (even if they score 100)
  const proceduralGames = ['word-rescue', 'snake', 'gravity-ball', 'slope-rider', 'neural-pulse', 'zen-gravity', 'shape-sequence'];
  if (proceduralGames.includes(gameScore.gameId)) {
    return gameScore;
  }

  // Only apply 2X multiplier to content puzzles with 100% accuracy
  const isContentPuzzle = CONTENT_PUZZLE_GAMES.includes(gameScore.gameId);

  // Check if the base score (before any bonuses) was 100% (with small tolerance for floating point)
  const baseScore = gameScore.normalizedScore;
  const isPerfectScore = Math.abs(baseScore - 100) < 0.001;

  console.log('[applyPerfectScoreBonus]', {
    gameId: gameScore.gameId,
    baseScore,
    isContentPuzzle,
    isPerfectScore,
    totalWithBonus: gameScore.totalWithBonus,
  });

  if (!isContentPuzzle || !isPerfectScore) {
    console.log(`[applyPerfectScoreBonus] Skipping bonus for ${gameScore.gameId}: isContentPuzzle=${isContentPuzzle}, isPerfectScore=${isPerfectScore}`);
    return gameScore;
  }

  // Perfect bonus is always 100 (the base 100% score gets doubled)
  const perfectScoreBonus = 100;
  // Add perfect bonus to any existing score (base + time bonus)
  const currentTotal = gameScore.totalWithBonus || gameScore.normalizedScore;
  const totalWithPerfectBonus = currentTotal + perfectScoreBonus;

  return {
    ...gameScore,
    perfectScoreBonus: Math.round(perfectScoreBonus),
    totalWithBonus: Math.round(totalWithPerfectBonus),
    isBonusApplied: true,
    grade: getGrade(Math.min(100, totalWithPerfectBonus)) // Cap grade at 100 visually but keep score
  };
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