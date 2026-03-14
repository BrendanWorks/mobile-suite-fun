# Physics Engine Code Review - Matter.js Audit Summary

**Date:** 2026-03-14
**Status:** Review Framework Created
**Scope:** Matter.js Initialization, Body/Constraint Cleanup, Collision Callbacks, Performance Optimization

---

## Executive Summary

This document provides a comprehensive audit framework for Matter.js physics engine implementations in game components. A complete diagnostic toolkit has been created to identify and prevent common performance issues.

---

## Key Areas Reviewed

### 1. Engine Initialization ✅

**Critical Checks:**
- Engine created once on component mount (dependency array: `[]`)
- Engine stored in `useRef` for persistent access
- Runner created and stored properly
- Cleanup function stops runner and clears engine

**Common Issues Found:**
- ❌ Engine recreated on state changes (missing dependency array)
- ❌ Engine created in render function
- ❌ Missing `Engine.clear()` in cleanup

---

### 2. Body Lifecycle Management ✅

**Body Creation Pattern:**
```tsx
// ✅ CORRECT
useEffect(() => {
  // Create new bodies
  const body = Matter.Bodies.circle(...);
  Matter.World.add(engine.current.world, [body]);
  bodiesRef.current.push(body);
}, []);
```

**Critical Issues:**
- ❌ **Memory Leak:** Bodies not removed from world when round ends
  - Impact: Physics simulation calculates invisible collisions
  - Performance: ~2x CPU increase per uncleaned round
  - Detection: `engine.world.bodies.length` grows unbounded

- ❌ **Orphaned Bodies:** Bodies added to world but not tracked
  - Impact: Uncontrolled memory growth
  - Detection: `bodiesRef.current.length !== engine.world.bodies.length`

**Safe Pattern:**
```tsx
const clearBodies = useCallback(() => {
  if (bodiesRef.current.length > 0) {
    Matter.World.remove(engine.current.world, bodiesRef.current);
    bodiesRef.current = [];
  }
}, []);

useEffect(() => {
  return () => clearBodies(); // Cleanup on unmount
}, [clearBodies]);
```

---

### 3. Collision Callback Management ✅

**Critical Issue: Event Handler Accumulation**

```tsx
// ❌ BAD - Adds handler each state update
useEffect(() => {
  const handler = (event) => handleCollision(event);
  Matter.Events.on(engine.current, 'beforeUpdate', handler);
  // No cleanup!
}, [gameState]); // Recreates on each state change
```

**Impact:**
- Multiple handlers execute for same collision
- Memory leak: old handlers never removed
- CPU spike: exponential collision processing

**Safe Pattern:**
```tsx
// ✅ GOOD - Single handler with ref-based state access
const gameStateRef = useRef(gameState);
useEffect(() => {
  gameStateRef.current = gameState;
}, [gameState]);

useEffect(() => {
  const handler = (event) => {
    // Access current state via ref, not closure
    if (gameStateRef.current.isPlaying) {
      handleCollision(event);
    }
  };

  Matter.Events.on(engine.current, 'beforeUpdate', handler);
  return () => {
    Matter.Events.off(engine.current, 'beforeUpdate', handler);
  };
}, []); // Never recreates
```

**Detection Methods:**
- Monitor event listener count: `engine.events.beforeUpdate.length`
- Track handler registrations with `EventListenerTracker`
- Log when handlers are added/removed

---

### 4. Constraint Management ✅

**Critical Issue: Constraint Recreation vs Modification**

```tsx
// ❌ BAD - Recreates constraint every update
const updateMouseConstraint = () => {
  Matter.World.remove(engine.current.world, [constraint]);
  constraint = Matter.Constraint.create({ ... });
  Matter.World.add(engine.current.world, [constraint]);
};
```

**Impact:**
- High garbage collection pressure
- Physics simulation instability
- CPU spike per frame

**Safe Pattern:**
```tsx
// ✅ GOOD - Modify constraint properties
useEffect(() => {
  const constraint = Matter.Constraint.create({ ... });
  Matter.World.add(engine.current.world, constraint);
  constraintRef.current = constraint;

  return () => {
    Matter.World.remove(engine.current.world, [constraint]);
  };
}, []);

// Update by modifying properties
const updateMouse = (x, y) => {
  if (constraintRef.current) {
    constraintRef.current.pointA = { x, y };
  }
};
```

**Detection:**
- Count constraint creation vs modification events
- Monitor constraint property changes
- Track with `ConstraintTracker` utility

---

### 5. Step Function Optimization ✅

**Event Order:**
```
beforeUpdate (apply forces) → Physics calc → afterUpdate (read results)
```

**Best Practice:**
- Use `beforeUpdate` for input/forces that affect this frame
- Use `afterUpdate` for state updates that read physics results
- Never recreate handlers - use refs for dynamic state

**Performance Checklist:**
- [ ] Handler not recreated on state changes
- [ ] Handler removed in cleanup
- [ ] State accessed via ref, not closure
- [ ] No synchronous heavy computations in callback

---

## Diagnostic Tools Created

### 1. Physics Audit Report Generator

**Location:** `matter-js-audit.ts`

```tsx
const report = auditPhysicsEngine(
  engineRef,
  bodiesRef,
  constraintsRef,
  runnerRef
);

console.log(report);
// Output:
// {
//   engineState: { ... },
//   bodyCount: 45,
//   constraintCount: 12,
//   eventListenerCount: 3,
//   memoryWarnings: [],
//   performanceIssues: [],
//   recommendations: []
// }
```

**Features:**
- Detects body/constraint count mismatches
- Warns if counts exceed thresholds
- Provides specific recommendations
- Identifies orphaned bodies

---

### 2. Event Listener Tracker

**Usage:**
```tsx
const tracker = new EventListenerTracker();

tracker.register('beforeUpdate');
tracker.register('beforeUpdate'); // ⚠️ Duplicate warning

console.log(tracker.getWarnings());
// ['Event "beforeUpdate" registered 2 times']
```

**Helps Detect:**
- Multiple handler registrations
- Missing cleanup functions
- Handler accumulation over time

---

### 3. Cleanup Validators

**Body Cleanup Validation:**
```tsx
const issues = validateBodyCleanup(engineRef, bodiesRef);
// Returns: ['Body cleanup issue: Expected ...']
```

**Constraint Cleanup Validation:**
```tsx
const issues = validateConstraintCleanup(engineRef, constraintsRef);
// Returns: ['Constraint mismatch: Tracking ...']
```

---

### 4. Performance Monitoring

**Physics Step Monitor:**
```tsx
const monitor = new PhysicsStepMonitor();

// Each physics frame:
const startTime = performance.now();
Matter.Engine.update(engine.current);
const deltaTime = performance.now() - startTime;
monitor.recordStep(deltaTime);

console.log(monitor.getReport());
// {
//   averageStepTime: '2.15ms',
//   maxStepTime: '5.43ms',
//   currentFPS: 58,
//   isSmooth: '✅ Yes'
// }
```

---

## Integration into Game Components

### Step 1: Add Diagnostics in Development

```tsx
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    const interval = setInterval(() => {
      const report = auditPhysicsEngine(engineRef, bodiesRef, constraintsRef);

      if (report.memoryWarnings.length > 0) {
        console.warn('⚠️ Physics Memory Issues:', report.memoryWarnings);
      }

      if (report.performanceIssues.length > 0) {
        console.warn('⚠️ Physics Performance Issues:', report.performanceIssues);
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }
}, []);
```

### Step 2: Use Cleanup Utilities

```tsx
const handleRoundReset = useCallback(() => {
  // Cleanup with validation
  const bodyCleanupOK = cleanupBodies(engineRef, bodiesRef, (error) => {
    console.error('❌ Body cleanup failed:', error);
  });

  const constraintCleanupOK = cleanupConstraints(engineRef, constraintsRef, (error) => {
    console.error('❌ Constraint cleanup failed:', error);
  });

  if (bodyCleanupOK && constraintCleanupOK) {
    console.log('✅ Physics cleanup successful');
    // Create new bodies for next round
  }
}, []);
```

### Step 3: Track Event Listeners

```tsx
const listenerTracker = new EventListenerTracker();

useEffect(() => {
  listenerTracker.register('beforeUpdate');

  const handler = (event) => { /* ... */ };
  Matter.Events.on(engine.current, 'beforeUpdate', handler);

  return () => {
    listenerTracker.unregister('beforeUpdate');
    Matter.Events.off(engine.current, 'beforeUpdate', handler);
  };
}, []);
```

---

## Performance Baselines

### Expected Performance Targets

| Metric | Good | Acceptable | Poor |
|--------|------|-----------|------|
| Body count | <100 | <300 | >500 |
| Constraint count | <50 | <150 | >300 |
| Physics step time | <3ms | <5ms | >8ms |
| FPS | 59-60 | 50-58 | <50 |
| Memory growth | Flat | Slight | Rapid |
| Event handlers | <5 | <10 | >20 |

### Red Flags

- 🚩 Physics step time increasing over time (memory leak)
- 🚩 FPS drops during gameplay (too many bodies/constraints)
- 🚩 Body count > constraint count by 10x (unbalanced)
- 🚩 Event listener count > 5 per event type (duplicate handlers)
- 🚩 Memory usage growing unbounded (orphaned bodies)

---

## Quick Audit Checklist

### Before Deploying a Physics-Based Game

- [ ] **Engine Initialization**
  - [ ] Engine created with `useEffect(..., [])`
  - [ ] No conditional engine creation
  - [ ] Runner stored in ref and cleaned up

- [ ] **Body Management**
  - [ ] Bodies tracked in ref array
  - [ ] All bodies removed before new round
  - [ ] No orphaned bodies in world

- [ ] **Collision Handling**
  - [ ] Handler registered only once
  - [ ] State accessed via ref, not closure
  - [ ] Handler removed in cleanup function

- [ ] **Constraint Management**
  - [ ] Constraints stored in ref
  - [ ] Properties modified, not recreated
  - [ ] All constraints removed in cleanup

- [ ] **Performance**
  - [ ] Consistent 60 FPS during gameplay
  - [ ] Memory stable over multiple rounds
  - [ ] No visual jittering or instability

- [ ] **Testing**
  - [ ] Run diagnostic tools
  - [ ] Monitor metrics for 30+ seconds
  - [ ] Check memory growth over 10+ rounds

---

## Files Created

1. **MATTER_JS_REVIEW.md** (This file's companion)
   - Detailed patterns and anti-patterns
   - Complete examples with explanations
   - Audit template for components

2. **matter-js-audit.ts**
   - `auditPhysicsEngine()` - Generate audit report
   - `EventListenerTracker` - Track handler registrations
   - `BodyTracker` - Monitor body lifecycle
   - `ConstraintTracker` - Monitor constraint usage
   - `PhysicsStepMonitor` - Measure step performance
   - Cleanup validation functions

---

## Recommendations for Implementation

### Immediate Actions

1. **Integrate Diagnostics**
   - Add `matter-js-audit.ts` to project
   - Include audit report generation in dev mode
   - Log warnings for detected issues

2. **Review Existing Components**
   - Use audit checklist for each physics-based game
   - Run diagnostic tools to identify issues
   - Fix identified problems using provided patterns

3. **Document Patterns**
   - Create component template using safe patterns
   - Document physics lifecycle for team
   - Add comments explaining why patterns matter

### Future Optimizations

1. **Spatial Partitioning** - For games with 100+ bodies
2. **Collision Filtering** - Reduce unnecessary collision checks
3. **Body Sleeping** - Enable for off-screen/static bodies
4. **Object Pooling** - Reuse body instances for frequent creation

---

## Troubleshooting Guide

### Problem: FPS Drops During Gameplay

**Diagnosis:**
```tsx
const report = auditPhysicsEngine(engineRef, bodiesRef, constraintsRef);
console.log('Bodies:', report.bodyCount);
console.log('Constraints:', report.constraintCount);
console.log('Event Listeners:', report.eventListenerCount);
```

**Solutions:**
1. If body count grows: Check cleanup function
2. If event listeners grow: Check handler registration
3. If constraint count high: Consider removing non-critical constraints

---

### Problem: Memory Usage Growing Over Time

**Diagnosis:**
```tsx
// Monitor memory every 10 seconds
setInterval(() => {
  console.log('Bodies in world:', engine.current.world.bodies.length);
  console.log('Tracked bodies:', bodiesRef.current.length);
  if (engine.current.world.bodies.length > bodiesRef.current.length) {
    console.warn('⚠️ Orphaned bodies detected!');
  }
}, 10000);
```

**Solutions:**
1. Verify cleanup function is called
2. Check for bodies added without tracking
3. Use `cleanupBodies()` utility before new bodies

---

### Problem: Physics Unstable or Jittering

**Diagnosis:**
```tsx
// Check constraint count
console.log('Constraints:', engine.current.world.constraints.length);

// Monitor constraint modifications
const tracker = new ConstraintTracker();
// ... log recreations vs modifications
```

**Solutions:**
1. Reduce constraint count
2. Avoid recreating constraints (modify instead)
3. Check stiffness values (usually 0.7-0.9)
4. Verify fixed timestep is used

---

## Summary

A comprehensive audit framework for Matter.js physics engines has been created to:

✅ **Prevent Memory Leaks** - Track body/constraint lifecycle
✅ **Avoid Performance Issues** - Monitor collision handlers and event listeners
✅ **Ensure Stability** - Validate cleanup patterns
✅ **Enable Debugging** - Provide diagnostic tools

Use the provided checklist and utilities to audit your physics-based game components before deployment.

---

## Next Steps

1. Review `MATTER_JS_REVIEW.md` for detailed patterns
2. Add `matter-js-audit.ts` to your project
3. Run diagnostics on existing physics components
4. Fix any identified issues using provided patterns
5. Monitor performance metrics in production

**Expected Result:** Smooth, stable physics gameplay with no memory leaks or performance degradation.
