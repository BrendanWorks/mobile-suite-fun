/**
 * Game Types - Core interfaces for Game Box architecture
 */

/**
 * Score data returned by each game
 */
export interface GameScore {
  score: number;      // Points earned by the player
  maxScore: number;   // Maximum possible points for this game session
}

/**
 * Handle interface that all game components must implement
 * Games expose this via forwardRef and useImperativeHandle
 */
export interface GameHandle {
  /**
   * Get the current score state from the game
   * Called when the game ends (time runs out or player quits)
   */
  getGameScore: () => GameScore;

  /**
   * Optional cleanup method called when game ends
   * Use this to stop animations, clear intervals, etc.
   */
  onGameEnd?: () => void;

  /**
   * Optional method to skip the current question
   * Called when player clicks "Skip Question" button
   */
  skipQuestion?: () => void;

  /**
   * Optional flag to show/hide Skip Question button
   * Defaults to true if skipQuestion is implemented
   */
  canSkipQuestion?: boolean;
}

/**
 * Game metadata for registration in GameSession
 */
export interface GameConfig {
  id: string;           // Unique identifier for the game
  name: string;         // Display name shown to players
  component: React.ComponentType<any>;  // The game component
  duration: number;     // Time limit in seconds
}
