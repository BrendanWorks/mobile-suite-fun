export const initGA = () => {
  // GA4 initialization placeholder
  console.log('Analytics initialized');
};

export const trackPageView = (page: string) => {
  console.log('Page view tracked:', page);
};

export const analytics = {
  signedIn: (provider: string, userId: string) => {
    console.log('User signed in:', { provider, userId });
  },

  signedOut: () => {
    console.log('User signed out');
  },

  gameSelected: (gameName: string, gameId: number) => {
    console.log('Game selected:', { gameName, gameId });
  },

  gameStarted: (gameName: string, gameId: number, userId: string) => {
    console.log('Game started:', { gameName, gameId, userId });
  },

  gameError: (gameName: string, error: string) => {
    console.error('Game error:', { gameName, error });
  },

  gameAbandoned: (gameName: string, puzzle: number, round: number) => {
    console.log('Game abandoned:', { gameName, puzzle, round });
  },

  puzzleCompleted: (gameName: string, puzzle: number, score: number, timeRemaining: number) => {
    console.log('Puzzle completed:', { gameName, puzzle, score, timeRemaining });
  },

  roundCompleted: (gameName: string, round: number, totalScore: number, perfectRound: boolean) => {
    console.log('Round completed:', { gameName, round, totalScore, perfectRound });
  },

  menuReturned: (gameName: string) => {
    console.log('Returned to menu from:', gameName);
  }
};
