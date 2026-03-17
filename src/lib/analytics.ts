import ReactGA from 'react-ga4';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gaEvent = (params: Record<string, any>) => ReactGA.event(params as any);

// Initialize GA4
export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (measurementId) {
    ReactGA.initialize(measurementId, {
      gaOptions: {
        anonymizeIp: true,
      },
    });
  }
};

// Track page views
export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: 'pageview', page: path });
};

// Track custom events
export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};

// Enhanced game analytics
export const analytics = {
  // ============================================================================
  // GAME LIFECYCLE
  // ============================================================================
  
  gameStarted: (gameName: string, gameId: number) => {
    gaEvent({
      category: 'Game',
      action: 'game_started',
      label: gameName,
      value: gameId,
      game_id: gameId,
      game_name: gameName,
    });
  },

  // ============================================================================
  // PUZZLE COMPLETION TRACKING
  // ============================================================================
  
  puzzleStarted: (gameName: string, roundNumber: number, puzzleNumber: number) => {
    gaEvent({
      category: 'Game',
      action: 'puzzle_started',
      label: `${gameName} - R${roundNumber}P${puzzleNumber}`,
      game_name: gameName,
      round_number: roundNumber,
      puzzle_number: puzzleNumber,
    });
  },

  puzzleCompleted: (
    gameName: string, 
    roundNumber: number,
    puzzleNumber: number, 
    score: number, 
    timeRemaining: number,
    isPerfect: boolean
  ) => {
    // Main completion event
    gaEvent({
      category: 'Game',
      action: 'puzzle_completed',
      label: `${gameName} - R${roundNumber}P${puzzleNumber}`,
      value: score,
      game_name: gameName,
      round_number: roundNumber,
      puzzle_number: puzzleNumber,
      score: score,
      time_remaining: timeRemaining,
      is_perfect: isPerfect,
    });

    // Milestone events for funnel analysis
    if (puzzleNumber === 1) {
      gaEvent({
        category: 'Milestone',
        action: 'completed_puzzle_1',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
      });
    } else if (puzzleNumber === 5) {
      gaEvent({
        category: 'Milestone',
        action: 'completed_puzzle_5',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
      });
    }

    // Perfect puzzle tracking
    if (isPerfect) {
      gaEvent({
        category: 'Achievement',
        action: 'perfect_puzzle',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
        puzzle_number: puzzleNumber,
      });
    }
  },

  // ============================================================================
  // ROUND COMPLETION TRACKING
  // ============================================================================

  roundCompleted: (
    gameName: string,
    roundNumber: number,
    totalScore: number,
    perfectRound: boolean,
    averageTimePerPuzzle: number
  ) => {
    // Main round completion
    gaEvent({
      category: 'Game',
      action: 'round_completed',
      label: `${gameName} - Round ${roundNumber}`,
      value: totalScore,
      game_name: gameName,
      round_number: roundNumber,
      total_score: totalScore,
      perfect_round: perfectRound,
      avg_time_per_puzzle: averageTimePerPuzzle,
    });

    // Milestone events for funnel analysis
    if (roundNumber === 1) {
      gaEvent({
        category: 'Milestone',
        action: 'completed_round_1',
        label: gameName,
        value: totalScore,
      });
    } else if (roundNumber === 5) {
      gaEvent({
        category: 'Milestone',
        action: 'completed_round_5',
        label: gameName,
        value: totalScore,
      });
    }

    // Perfect round tracking
    if (perfectRound) {
      gaEvent({
        category: 'Achievement',
        action: 'perfect_round',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
        total_score: totalScore,
      });
    }
  },

  roundScore: (
    gameName: string,
    roundNumber: number,
    score: number,
    maxPossibleScore: number,
    puzzlesCompleted: number
  ) => {
    const scorePercentage = Math.round((score / maxPossibleScore) * 100);

    gaEvent({
      category: 'Score',
      action: 'round_score',
      label: `${gameName} - Round ${roundNumber}`,
      value: score,
      game_name: gameName,
      round_number: roundNumber,
      score: score,
      max_possible_score: maxPossibleScore,
      score_percentage: scorePercentage,
      puzzles_completed: puzzlesCompleted,
    });

    // Track score tiers for analysis
    if (scorePercentage >= 90) {
      gaEvent({
        category: 'Score',
        action: 'high_round_score',
        label: gameName,
        value: score,
        round_number: roundNumber,
      });
    } else if (scorePercentage < 50) {
      gaEvent({
        category: 'Score',
        action: 'low_round_score',
        label: gameName,
        value: score,
        round_number: roundNumber,
      });
    }
  },

  roundSuccess: (
    gameName: string,
    roundNumber: number,
    success: boolean,
    score: number,
    timeSpent: number
  ) => {
    gaEvent({
      category: 'Game',
      action: success ? 'round_success' : 'round_failure',
      label: `${gameName} - Round ${roundNumber}`,
      value: score,
      game_name: gameName,
      round_number: roundNumber,
      success: success,
      score: score,
      time_spent: timeSpent,
    });
  },

  // ============================================================================
  // GAME COMPLETION
  // ============================================================================

  gameCompleted: (
    gameName: string,
    totalScore: number,
    perfectGame: boolean,
    totalTimePlayed: number
  ) => {
    gaEvent({
      category: 'Game',
      action: 'game_completed',
      label: gameName,
      value: totalScore,
      game_name: gameName,
      total_score: totalScore,
      perfect_game: perfectGame,
      total_time_played: totalTimePlayed,
    });

    // Track full game completion as milestone
    gaEvent({
      category: 'Milestone',
      action: 'completed_full_game',
      label: gameName,
      value: totalScore,
    });

    if (perfectGame) {
      gaEvent({
        category: 'Achievement',
        action: 'perfect_game',
        label: gameName,
        total_score: totalScore,
      });
    }
  },

  // ============================================================================
  // DROP-OFF TRACKING
  // ============================================================================

  gameAbandoned: (
    gameName: string, 
    roundNumber: number,
    puzzleNumber: number,
    currentScore: number,
    timePlayedSeconds: number
  ) => {
    gaEvent({
      category: 'Game',
      action: 'game_abandoned',
      label: `${gameName} - R${roundNumber}P${puzzleNumber}`,
      value: currentScore,
      game_name: gameName,
      round_number: roundNumber,
      puzzle_number: puzzleNumber,
      score_at_quit: currentScore,
      time_played: timePlayedSeconds,
    });

    // Track specific drop-off points
    gaEvent({
      category: 'Dropoff',
      action: `quit_at_r${roundNumber}p${puzzleNumber}`,
      label: gameName,
      game_name: gameName,
      round_number: roundNumber,
      puzzle_number: puzzleNumber,
    });
  },

  // ============================================================================
  // SCORE ANALYTICS
  // ============================================================================

  scoreThreshold: (gameName: string, threshold: number, actualScore: number) => {
    gaEvent({
      category: 'Score',
      action: `score_above_${threshold}`,
      label: gameName,
      value: actualScore,
      game_name: gameName,
      score: actualScore,
    });
  },

  lowScore: (gameName: string, roundNumber: number, puzzleNumber: number, score: number) => {
    if (score < 500) { // Less than 50% of max
      gaEvent({
        category: 'Score',
        action: 'low_score',
        label: gameName,
        value: score,
        game_name: gameName,
        round_number: roundNumber,
        puzzle_number: puzzleNumber,
      });
    }
  },

  // ============================================================================
  // STREAK TRACKING
  // ============================================================================

  streakAchieved: (gameName: string, streakLength: number, streakType: 'puzzle' | 'round') => {
    gaEvent({
      category: 'Achievement',
      action: `${streakType}_streak_${streakLength}`,
      label: gameName,
      value: streakLength,
      game_name: gameName,
      streak_type: streakType,
      streak_length: streakLength,
    });
  },

  // ============================================================================
  // NAVIGATION EVENTS
  // ============================================================================

  gameSelected: (gameName: string, gameId: number) => {
    gaEvent({
      category: 'Navigation',
      action: 'game_selected',
      label: gameName,
      value: gameId,
      game_name: gameName,
    });
  },

  menuReturned: (fromGame?: string, completedGame?: boolean) => {
    gaEvent({
      category: 'Navigation',
      action: 'menu_returned',
      label: fromGame || 'unknown',
      from_game: fromGame,
      completed_game: completedGame,
    });
  },

  // ============================================================================
  // USER EVENTS
  // ============================================================================

  accountCreated: (provider: string) => {
    gaEvent({
      category: 'User',
      action: 'account_created',
      label: provider,
    });
  },

  signedIn: (provider: string) => {
    gaEvent({
      category: 'User',
      action: 'signed_in',
      label: provider,
    });
  },

  signedOut: () => {
    gaEvent({
      category: 'User',
      action: 'signed_out',
    });
  },

  // ============================================================================
  // ERROR TRACKING
  // ============================================================================

  gameError: (gameName: string, errorMessage: string, context?: string) => {
    gaEvent({
      category: 'Error',
      action: 'game_error',
      label: `${gameName}: ${errorMessage}`,
      game_name: gameName,
      error_message: errorMessage,
      context: context,
    });
  },

  // ============================================================================
  // USABILITY & ENGAGEMENT TRACKING
  // ============================================================================

  puzzleTimeSpent: (
    gameName: string,
    roundNumber: number,
    puzzleNumber: number,
    timeSpentSeconds: number
  ) => {
    gaEvent({
      category: 'Engagement',
      action: 'puzzle_time_spent',
      label: `${gameName} - R${roundNumber}P${puzzleNumber}`,
      value: Math.round(timeSpentSeconds),
      game_name: gameName,
      round_number: roundNumber,
      puzzle_number: puzzleNumber,
      time_spent: timeSpentSeconds,
    });

    // Track if puzzle took unusually long (potential confusion/difficulty)
    if (timeSpentSeconds > 60) {
      gaEvent({
        category: 'Engagement',
        action: 'puzzle_long_duration',
        label: gameName,
        value: Math.round(timeSpentSeconds),
        round_number: roundNumber,
        puzzle_number: puzzleNumber,
      });
    }
  },

  puzzleRetry: (
    gameName: string,
    roundNumber: number,
    puzzleNumber: number,
    attemptNumber: number
  ) => {
    gaEvent({
      category: 'Engagement',
      action: 'puzzle_retry',
      label: `${gameName} - R${roundNumber}P${puzzleNumber}`,
      value: attemptNumber,
      game_name: gameName,
      round_number: roundNumber,
      puzzle_number: puzzleNumber,
      attempt_number: attemptNumber,
    });
  },

  gameInteraction: (
    gameName: string,
    interactionType: string,
    context?: string
  ) => {
    gaEvent({
      category: 'Interaction',
      action: interactionType,
      label: `${gameName}${context ? ` - ${context}` : ''}`,
      game_name: gameName,
      interaction_type: interactionType,
      context: context,
    });
  },

  difficultyFeedback: (
    gameName: string,
    roundNumber: number,
    perceivedDifficulty: 'easy' | 'medium' | 'hard'
  ) => {
    gaEvent({
      category: 'Feedback',
      action: 'difficulty_perception',
      label: `${gameName} - ${perceivedDifficulty}`,
      game_name: gameName,
      round_number: roundNumber,
      difficulty: perceivedDifficulty,
    });
  },

  sessionDuration: (
    gameName: string,
    durationSeconds: number,
    roundsCompleted: number,
    puzzlesCompleted: number
  ) => {
    gaEvent({
      category: 'Engagement',
      action: 'session_duration',
      label: gameName,
      value: Math.round(durationSeconds),
      game_name: gameName,
      duration_seconds: durationSeconds,
      rounds_completed: roundsCompleted,
      puzzles_completed: puzzlesCompleted,
    });

    // Track engagement tiers
    if (durationSeconds > 300) { // 5+ minutes
      gaEvent({
        category: 'Engagement',
        action: 'high_engagement',
        label: gameName,
        value: Math.round(durationSeconds),
      });
    }
  },

  userProgressMilestone: (
    milestone: string,
    value: number
  ) => {
    gaEvent({
      category: 'Progress',
      action: 'milestone_reached',
      label: milestone,
      value: value,
      milestone: milestone,
    });
  },

  // ============================================================================
  // PERFORMANCE TRACKING
  // ============================================================================

  performanceMetric: (metricName: string, value: number, context?: string) => {
    gaEvent({
      category: 'Performance',
      action: metricName,
      label: context || 'general',
      value: Math.round(value),
    });
  },
};