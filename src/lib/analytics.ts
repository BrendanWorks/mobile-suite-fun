import ReactGA from 'react-ga4';

// Initialize GA4
export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (measurementId) {
    ReactGA.initialize(measurementId, {
      gaOptions: {
        anonymizeIp: true,
      },
    });
    console.log('GA4 initialized:', measurementId);
  } else {
    console.warn('GA4 Measurement ID not found in environment variables');
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
  
  gameStarted: (gameName: string, gameId: number, userId?: string) => {
    ReactGA.event({
      category: 'Game',
      action: 'game_started',
      label: gameName,
      value: gameId,
      game_id: gameId,
      game_name: gameName,
    });
    if (userId) {
      ReactGA.set({ userId });
    }
  },

  // ============================================================================
  // PUZZLE COMPLETION TRACKING
  // ============================================================================
  
  puzzleStarted: (gameName: string, roundNumber: number, puzzleNumber: number) => {
    ReactGA.event({
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
    ReactGA.event({
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
      ReactGA.event({
        category: 'Milestone',
        action: 'completed_puzzle_1',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
      });
    } else if (puzzleNumber === 5) {
      ReactGA.event({
        category: 'Milestone',
        action: 'completed_puzzle_5',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
      });
    }

    // Perfect puzzle tracking
    if (isPerfect) {
      ReactGA.event({
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
    ReactGA.event({
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
      ReactGA.event({
        category: 'Milestone',
        action: 'completed_round_1',
        label: gameName,
        value: totalScore,
      });
    } else if (roundNumber === 5) {
      ReactGA.event({
        category: 'Milestone',
        action: 'completed_round_5',
        label: gameName,
        value: totalScore,
      });
    }

    // Perfect round tracking
    if (perfectRound) {
      ReactGA.event({
        category: 'Achievement',
        action: 'perfect_round',
        label: gameName,
        game_name: gameName,
        round_number: roundNumber,
        total_score: totalScore,
      });
    }
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
    ReactGA.event({
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
    ReactGA.event({
      category: 'Milestone',
      action: 'completed_full_game',
      label: gameName,
      value: totalScore,
    });

    if (perfectGame) {
      ReactGA.event({
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
    ReactGA.event({
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
    ReactGA.event({
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
    ReactGA.event({
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
      ReactGA.event({
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
    ReactGA.event({
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
    ReactGA.event({
      category: 'Navigation',
      action: 'game_selected',
      label: gameName,
      value: gameId,
      game_name: gameName,
    });
  },

  menuReturned: (fromGame?: string, completedGame?: boolean) => {
    ReactGA.event({
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

  accountCreated: (provider: string, userId: string) => {
    ReactGA.event({
      category: 'User',
      action: 'account_created',
      label: provider,
    });
    ReactGA.set({ userId });
  },

  signedIn: (provider: string, userId: string) => {
    ReactGA.event({
      category: 'User',
      action: 'signed_in',
      label: provider,
    });
    ReactGA.set({ userId });
  },

  signedOut: () => {
    ReactGA.event({
      category: 'User',
      action: 'signed_out',
    });
  },

  // ============================================================================
  // ERROR TRACKING
  // ============================================================================

  gameError: (gameName: string, errorMessage: string, context?: string) => {
    ReactGA.event({
      category: 'Error',
      action: 'game_error',
      label: `${gameName}: ${errorMessage}`,
      game_name: gameName,
      error_message: errorMessage,
      context: context,
    });
  },

  // ============================================================================
  // PERFORMANCE TRACKING
  // ============================================================================

  performanceMetric: (metricName: string, value: number, context?: string) => {
    ReactGA.event({
      category: 'Performance',
      action: metricName,
      label: context || 'general',
      value: Math.round(value),
    });
  },
};