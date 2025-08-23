// Game Configuration Constants for Advanced Runner
export const GAME_CONFIG = {
  // Canvas & World
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 800,
  
  // Character Positions
  KAI_X: 600,
  KAI_Y: 400,
  KAI_SIZE: 60,
  
  // Ground Configuration
  GROUND_X: 600,
  GROUND_Y: 500,
  GROUND_WIDTH: 1200,
  GROUND_HEIGHT: 100,
  GROUND_SURFACE_Y: 450, // Ground top surface (500 - 50)
  
  // Obstacle Spawning (Goldilocks Zone!)
  OBSTACLE_SPAWN_X: 750,
  
  // Obstacle Sizes
  GROUND_OBSTACLE_WIDTH: 30,
  GROUND_OBSTACLE_HEIGHT: 60,
  SPHERE_RADIUS: 20,
  FLYING_RADIUS: 20,
  
  // Physics Values
  GRAVITY: 1,
  FRICTION: 0.8,
  RESTITUTION: 0,
  OBSTACLE_VELOCITY: -4,
  ROLLING_VELOCITY: -3,
  FLYING_VELOCITY: -3,
  JUMP_FORCE: -0.12,
  DASH_FORCE: 0.12,
  CROUCH_FORCE: 0.05,
  
  // Flying Obstacle Heights
  FLYING_MIN_Y: 350,
  FLYING_MAX_Y: 450,
  
  // Touch Gesture Thresholds
  MIN_SWIPE_DISTANCE: 30,
  MAX_TAP_TIME: 300,
  MAX_TAP_DISTANCE: 10,
  
  // Cleanup Boundaries
  CLEANUP_LEFT: -100,
  CLEANUP_RIGHT: 1300,
  CLEANUP_BOTTOM: 900,
  CLEANUP_TOP: -100
};