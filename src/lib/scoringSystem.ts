export interface GameScore {
  gameId: string;
  gameName: string;
  rawScore: number;
  normalizedScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  breakdown: string;
}

const calculateGrade = (score: number): 'S' | 'A' | 'B' | 'C' | 'D' => {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
};

export const scoringSystem = {
  oddManOut: (correct: number, total: number): GameScore => {
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    const normalizedScore = Math.round(accuracy);
    return {
      gameId: 'odd-man-out',
      gameName: 'Odd Man Out',
      rawScore: correct,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `${correct}/${total} correct (${normalizedScore}% accuracy)`
    };
  },

  rankAndRoll: (rawScore: number): GameScore => {
    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    return {
      gameId: 'rank-and-roll',
      gameName: 'Ranky',
      rawScore,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `Score: ${Math.round(rawScore)}`
    };
  },

  shapeSequence: (rawScore: number): GameScore => {
    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    return {
      gameId: 'shape-sequence',
      gameName: 'Shape Sequence',
      rawScore,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `Score: ${Math.round(rawScore)}`
    };
  },

  splitDecision: (correct: number, wrong: number): GameScore => {
    const total = correct + wrong;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    const normalizedScore = Math.round(accuracy);
    return {
      gameId: 'split-decision',
      gameName: 'Split Decision',
      rawScore: correct,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `${correct}/${total} correct (${normalizedScore}% accuracy)`
    };
  },

  pop: (rawScore: number): GameScore => {
    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    return {
      gameId: 'word-rescue',
      gameName: 'Pop',
      rawScore,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `Score: ${Math.round(rawScore)}`
    };
  },

  zooma: (rawScore: number): GameScore => {
    const normalizedScore = Math.min(100, Math.max(0, rawScore));
    return {
      gameId: 'photo-mystery',
      gameName: 'Zooma',
      rawScore,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `Score: ${Math.round(rawScore)}`
    };
  },

  dalmatian: (completed: boolean, timeSpent: number, maxTime: number): GameScore => {
    let normalizedScore = 0;
    if (completed) {
      const timeRatio = Math.max(0, 1 - (timeSpent / maxTime));
      normalizedScore = Math.round(50 + (timeRatio * 50));
    }
    return {
      gameId: 'dalmatian-puzzle',
      gameName: 'Dalmatian Puzzle',
      rawScore: completed ? 1 : 0,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: completed
        ? `Completed in ${Math.round(timeSpent)}s`
        : 'Puzzle not completed'
    };
  },

  emojiMaster: (correct: number, total: number): GameScore => {
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    const normalizedScore = Math.round(accuracy);
    return {
      gameId: 'emoji-master',
      gameName: 'Emoji Master',
      rawScore: correct,
      normalizedScore,
      grade: calculateGrade(normalizedScore),
      breakdown: `${correct}/${total} correct (${normalizedScore}% accuracy)`
    };
  }
};

export interface SessionScore {
  totalScore: number;
  maxPossible: number;
  percentage: number;
  averageScore: number;
}

export const calculateSessionScore = (scores: GameScore[]): SessionScore => {
  const totalScore = scores.reduce((sum, score) => sum + score.normalizedScore, 0);
  const maxPossible = scores.length * 100;
  const percentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
  const averageScore = scores.length > 0 ? Math.round(totalScore / scores.length) : 0;

  return {
    totalScore: Math.round(totalScore),
    maxPossible,
    percentage,
    averageScore
  };
};

export const getSessionGrade = (percentage: number): 'S' | 'A' | 'B' | 'C' | 'D' => {
  return calculateGrade(percentage);
};
