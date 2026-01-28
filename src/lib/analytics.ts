import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log('Google Analytics initialized with ID:', GA_MEASUREMENT_ID);
  } else {
    console.log('Google Analytics not initialized - no measurement ID found');
  }
};

export const trackPageView = (page: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.send({ hitType: 'pageview', page });
  }
  console.log('Page view tracked:', page);
};

export const analytics = {
  signedIn: (provider: string, userId: string) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Auth',
        action: 'Sign In',
        label: provider,
      });
    }
    console.log('User signed in:', { provider, userId });
  },

  signedOut: () => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Auth',
        action: 'Sign Out',
      });
    }
    console.log('User signed out');
  },

  gameSelected: (gameName: string, gameId: number) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Game',
        action: 'Game Selected',
        label: gameName,
        value: gameId,
      });
    }
    console.log('Game selected:', { gameName, gameId });
  },

  gameStarted: (gameName: string, gameId: number, userId: string) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Game',
        action: 'Game Started',
        label: gameName,
        value: gameId,
      });
    }
    console.log('Game started:', { gameName, gameId, userId });
  },

  gameError: (gameName: string, error: string) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Game',
        action: 'Game Error',
        label: `${gameName}: ${error}`,
      });
    }
    console.error('Game error:', { gameName, error });
  },

  gameAbandoned: (gameName: string, puzzle: number, round: number) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Game',
        action: 'Game Abandoned',
        label: gameName,
        value: puzzle,
      });
    }
    console.log('Game abandoned:', { gameName, puzzle, round });
  },

  puzzleCompleted: (gameName: string, puzzle: number, score: number, timeRemaining: number) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Game',
        action: 'Puzzle Completed',
        label: gameName,
        value: score,
      });
    }
    console.log('Puzzle completed:', { gameName, puzzle, score, timeRemaining });
  },

  roundCompleted: (gameName: string, round: number, totalScore: number, perfectRound: boolean) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Game',
        action: 'Round Completed',
        label: gameName,
        value: totalScore,
      });
    }
    console.log('Round completed:', { gameName, round, totalScore, perfectRound });
  },

  menuReturned: (gameName: string) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'Navigation',
        action: 'Return to Menu',
        label: gameName,
      });
    }
    console.log('Returned to menu from:', gameName);
  }
};
