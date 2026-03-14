/**
 * Matter.js Audit Utility
 *
 * Use this to diagnose physics engine issues in game components.
 * Add to your component and call audit functions to identify problems.
 */

interface PhysicsAuditReport {
  engineState: EngineStatus;
  bodyCount: number;
  constraintCount: number;
  eventListenerCount: number;
  memoryWarnings: string[];
  performanceIssues: string[];
  recommendations: string[];
}

interface EngineStatus {
  exists: boolean;
  runnerActive: boolean;
  broadphaseEnabled: boolean;
  sleepingEnabled: boolean;
}

/**
 * Creates a physics audit report for Matter.js engine
 * Call this periodically to monitor physics state
 */
export function auditPhysicsEngine(
  engineRef: React.MutableRefObject<any>,
  bodiesRef: React.MutableRefObject<any[]>,
  constraintsRef: React.MutableRefObject<any[]>,
  runnerRef?: React.MutableRefObject<any>
): PhysicsAuditReport {
  const report: PhysicsAuditReport = {
    engineState: {
      exists: !!engineRef.current,
      runnerActive: !!runnerRef?.current,
      broadphaseEnabled: engineRef.current?.broadphase?.active ?? false,
      sleepingEnabled: engineRef.current?.enableSleeping ?? false,
    },
    bodyCount: engineRef.current?.world?.bodies?.length ?? 0,
    constraintCount: engineRef.current?.world?.constraints?.length ?? 0,
    eventListenerCount: countEventListeners(engineRef.current),
    memoryWarnings: [],
    performanceIssues: [],
    recommendations: [],
  };

  // Check for memory issues
  if (report.bodyCount > 1000) {
    report.memoryWarnings.push(`⚠️ High body count: ${report.bodyCount} bodies (threshold: 1000)`);
    report.recommendations.push('Consider removing off-screen bodies or using object pooling');
  }

  if (report.constraintCount > 500) {
    report.memoryWarnings.push(`⚠️ High constraint count: ${report.constraintCount} constraints (threshold: 500)`);
    report.recommendations.push('Review constraint lifecycle - some may not be cleaned up');
  }

  // Check for cleanup issues
  if (bodiesRef.current.length !== report.bodyCount) {
    report.performanceIssues.push(
      `⚠️ Body tracking mismatch: tracking ${bodiesRef.current.length} but world has ${report.bodyCount}`
    );
    report.recommendations.push('Check if bodies are being added to world without tracking in ref');
  }

  // Check for event listener accumulation
  if (report.eventListenerCount > 10) {
    report.performanceIssues.push(
      `⚠️ Many event listeners: ${report.eventListenerCount} (possible multiple registrations)`
    );
    report.recommendations.push('Review event listener cleanup in useEffect hooks');
  }

  // Performance recommendations
  if (!report.engineState.sleepingEnabled && report.bodyCount > 100) {
    report.recommendations.push('Enable sleeping: engine.enableSleeping = true to improve performance');
  }

  if (!report.engineState.broadphaseEnabled && report.bodyCount > 500) {
    report.recommendations.push('Consider enabling broadphase optimization for collision detection');
  }

  return report;
}

/**
 * Counts event listeners attached to engine
 * Note: Matter.js doesn't expose this directly, this is a heuristic
 */
function countEventListeners(engine: any): number {
  if (!engine || !engine.events) return 0;

  let count = 0;
  const events = [
    'beforeUpdate',
    'afterUpdate',
    'collisionStart',
    'collisionEnd',
    'collisionActive',
    'beforeRender',
    'afterRender',
  ];

  for (const eventName of events) {
    // This is a heuristic - actual count depends on implementation
    if (engine.events[eventName]) {
      count += engine.events[eventName].length ?? 0;
    }
  }

  return count;
}

/**
 * Validates body cleanup before creating new bodies
 * Call this at the start of body creation functions
 */
export function validateBodyCleanup(
  engineRef: React.MutableRefObject<any>,
  bodiesRef: React.MutableRefObject<any[]>,
  expectedRetain: number = 0
): string[] {
  const issues: string[] = [];

  if (!engineRef.current) {
    issues.push('Engine not initialized');
    return issues;
  }

  const trackedCount = bodiesRef.current.length;
  const worldCount = engineRef.current.world.bodies.length;

  if (trackedCount > 0 && trackedCount !== worldCount - expectedRetain) {
    issues.push(
      `Body cleanup issue: Expected ${trackedCount} tracked bodies + ${expectedRetain} retained, ` +
      `but world has ${worldCount} total`
    );
  }

  // Check for orphaned bodies (in world but not tracked)
  if (worldCount > (trackedCount + expectedRetain)) {
    issues.push(
      `⚠️ Orphaned bodies detected: ${worldCount - trackedCount - expectedRetain} bodies in world ` +
      `but not tracked - possible memory leak`
    );
  }

  return issues;
}

/**
 * Validates constraint cleanup
 */
export function validateConstraintCleanup(
  engineRef: React.MutableRefObject<any>,
  constraintsRef: React.MutableRefObject<any[]>
): string[] {
  const issues: string[] = [];

  if (!engineRef.current) {
    issues.push('Engine not initialized');
    return issues;
  }

  const trackedCount = constraintsRef.current.length;
  const worldCount = engineRef.current.world.constraints.length;

  if (trackedCount !== worldCount) {
    issues.push(
      `Constraint mismatch: Tracking ${trackedCount} constraints but world has ${worldCount}`
    );
  }

  return issues;
}

/**
 * Safe body cleanup function - can be called from anywhere
 * Logs issues if cleanup fails
 */
export function cleanupBodies(
  engineRef: React.MutableRefObject<any>,
  bodiesRef: React.MutableRefObject<any[]>,
  onError?: (error: string) => void
): boolean {
  try {
    if (!engineRef.current) {
      const msg = 'Cannot cleanup: Engine not initialized';
      onError?.(msg);
      return false;
    }

    if (bodiesRef.current.length === 0) {
      return true; // Nothing to clean
    }

    // Validate before cleanup
    const validationIssues = validateBodyCleanup(engineRef.current, bodiesRef.current);
    if (validationIssues.length > 0) {
      console.warn('Issues before cleanup:', validationIssues);
    }

    // Remove all tracked bodies
    const Matter = require('matter-js');
    Matter.World.remove(engineRef.current.world, bodiesRef.current);
    bodiesRef.current = [];

    console.log('✅ Bodies cleaned up successfully');
    return true;
  } catch (error) {
    const msg = `Cleanup error: ${error instanceof Error ? error.message : String(error)}`;
    onError?.(msg);
    console.error(msg);
    return false;
  }
}

/**
 * Safe constraint cleanup
 */
export function cleanupConstraints(
  engineRef: React.MutableRefObject<any>,
  constraintsRef: React.MutableRefObject<any[]>,
  onError?: (error: string) => void
): boolean {
  try {
    if (!engineRef.current) {
      const msg = 'Cannot cleanup: Engine not initialized';
      onError?.(msg);
      return false;
    }

    if (constraintsRef.current.length === 0) {
      return true; // Nothing to clean
    }

    const Matter = require('matter-js');
    Matter.World.remove(engineRef.current.world, constraintsRef.current);
    constraintsRef.current = [];

    console.log('✅ Constraints cleaned up successfully');
    return true;
  } catch (error) {
    const msg = `Constraint cleanup error: ${error instanceof Error ? error.message : String(error)}`;
    onError?.(msg);
    console.error(msg);
    return false;
  }
}

/**
 * Event listener validator
 * Helps detect multiple handler registrations
 */
export class EventListenerTracker {
  private listeners: Map<string, number> = new Map();

  /**
   * Register an event listener registration
   */
  register(eventName: string): void {
    const count = this.listeners.get(eventName) ?? 0;
    this.listeners.set(eventName, count + 1);

    if (count > 0) {
      console.warn(
        `⚠️ Event "${eventName}" registered ${count + 1} times - possible duplicate handler`
      );
    }
  }

  /**
   * Unregister an event listener
   */
  unregister(eventName: string): void {
    const count = this.listeners.get(eventName) ?? 0;
    if (count > 0) {
      this.listeners.set(eventName, count - 1);
    }
  }

  /**
   * Get report of all registered listeners
   */
  getReport(): Record<string, number> {
    return Object.fromEntries(this.listeners);
  }

  /**
   * Get warnings for duplicate listeners
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    for (const [eventName, count] of this.listeners) {
      if (count > 1) {
        warnings.push(`Event "${eventName}" registered ${count} times`);
      }
    }
    return warnings;
  }

  /**
   * Clear all registrations
   */
  reset(): void {
    this.listeners.clear();
  }
}

/**
 * Constraint tracker - validates modification vs recreation pattern
 */
export class ConstraintTracker {
  private createdCount = 0;
  private recreatedCount = 0;
  private modifiedCount = 0;

  recordCreation(): void {
    this.createdCount++;
  }

  recordRecreation(): void {
    this.recreatedCount++;
    if (this.recreatedCount > 5) {
      console.warn(
        `⚠️ Constraint recreated ${this.recreatedCount} times - ` +
        `consider modifying properties instead of recreating`
      );
    }
  }

  recordModification(): void {
    this.modifiedCount++;
  }

  getReport() {
    return {
      created: this.createdCount,
      recreated: this.recreatedCount,
      modified: this.modifiedCount,
      efficiency: this.modifiedCount > this.recreatedCount ? '✅ Good' : '⚠️ Inefficient',
    };
  }

  reset(): void {
    this.createdCount = 0;
    this.recreatedCount = 0;
    this.modifiedCount = 0;
  }
}

/**
 * Body tracker - validates lifecycle patterns
 */
export class BodyTracker {
  private createdCount = 0;
  private destroyedCount = 0;
  private orphanedBodies: any[] = [];

  recordCreation(bodyCount: number = 1): void {
    this.createdCount += bodyCount;
  }

  recordDestruction(bodyCount: number = 1): void {
    this.destroyedCount += bodyCount;
  }

  recordOrphaned(body: any): void {
    this.orphanedBodies.push(body);
    if (this.orphanedBodies.length > 10) {
      console.warn(
        `⚠️ ${this.orphanedBodies.length} orphaned bodies detected - possible memory leak`
      );
    }
  }

  getReport() {
    return {
      created: this.createdCount,
      destroyed: this.destroyedCount,
      net: this.createdCount - this.destroyedCount,
      orphaned: this.orphanedBodies.length,
      balanced: this.createdCount === this.destroyedCount ? '✅ Yes' : '⚠️ No',
    };
  }

  reset(): void {
    this.createdCount = 0;
    this.destroyedCount = 0;
    this.orphanedBodies = [];
  }
}

/**
 * Performance monitor for physics step
 */
export class PhysicsStepMonitor {
  private stepTimes: number[] = [];
  private maxSteps = 60; // Track last 60 frames

  recordStep(deltaTime: number): void {
    this.stepTimes.push(deltaTime);
    if (this.stepTimes.length > this.maxSteps) {
      this.stepTimes.shift();
    }
  }

  getAverageStepTime(): number {
    if (this.stepTimes.length === 0) return 0;
    const sum = this.stepTimes.reduce((a, b) => a + b, 0);
    return sum / this.stepTimes.length;
  }

  getMaxStepTime(): number {
    return Math.max(...this.stepTimes, 0);
  }

  getReport() {
    const avg = this.getAverageStepTime();
    const max = this.getMaxStepTime();
    const fps = avg > 0 ? Math.round(1000 / avg) : 0;
    const frameTimeMs = (1000 / 60).toFixed(2); // Target 60 FPS

    return {
      averageStepTime: `${avg.toFixed(2)}ms`,
      maxStepTime: `${max.toFixed(2)}ms`,
      currentFPS: fps,
      targetFPS: 60,
      isSmooth: fps >= 55 ? '✅ Yes' : '⚠️ No',
      note: `Target frame time: ${frameTimeMs}ms for 60 FPS`,
    };
  }

  reset(): void {
    this.stepTimes = [];
  }
}

/**
 * Example usage in a game component:
 *
 * const engineRef = useRef(null);
 * const bodiesRef = useRef([]);
 * const constraintsRef = useRef([]);
 *
 * // In development, audit periodically
 * useEffect(() => {
 *   const interval = setInterval(() => {
 *     if (process.env.NODE_ENV === 'development') {
 *       const report = auditPhysicsEngine(engineRef, bodiesRef, constraintsRef);
 *       if (report.memoryWarnings.length > 0 || report.performanceIssues.length > 0) {
 *         console.warn('Physics audit report:', report);
 *       }
 *     }
 *   }, 5000); // Check every 5 seconds
 *
 *   return () => clearInterval(interval);
 * }, []);
 */
