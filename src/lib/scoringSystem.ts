export interface ScoreCalculation {
  baseScore: number;
  timeBonus: number;
  accuracyBonus: number;
  streakBonus: number;
  totalScore: number;
}

export interface ScoreParams {
  correctAnswers: number;
  totalQuestions: number;
  timeElapsed: number;
  maxTime: number;
  streak?: number;
}

export const calculateScore = (params: ScoreParams): ScoreCalculation => {
  const { correctAnswers, totalQuestions, timeElapsed, maxTime, streak = 0 } = params;

  // Base score: 100 points per correct answer
  const baseScore = correctAnswers * 100;

  // Time bonus: Up to 50 points per question based on speed
  const timeRatio = Math.max(0, 1 - (timeElapsed / maxTime));
  const timeBonus = Math.floor(timeRatio * 50 * correctAnswers);

  // Accuracy bonus: Up to 100 points based on percentage correct
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
  const accuracyBonus = Math.floor(accuracy * 100);

  // Streak bonus: 25 points per consecutive correct answer
  const streakBonus = streak * 25;

  // Total score
  const totalScore = baseScore + timeBonus + accuracyBonus + streakBonus;

  return {
    baseScore,
    timeBonus,
    accuracyBonus,
    streakBonus,
    totalScore
  };
};

export const calculateStars = (score: number, thresholds: { onestar: number; twostar: number; threestar: number }): number => {
  if (score >= thresholds.threestar) return 3;
  if (score >= thresholds.twostar) return 2;
  if (score >= thresholds.onestar) return 1;
  return 0;
};

export const calculateRank = (score: number): string => {
  if (score >= 2000) return 'S';
  if (score >= 1500) return 'A';
  if (score >= 1000) return 'B';
  if (score >= 500) return 'C';
  return 'D';
};
