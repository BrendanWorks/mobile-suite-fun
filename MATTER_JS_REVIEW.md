# Matter.js Physics Engine Code Review

**Date:** 2026-03-14
**Focus:** Initialization, Body Cleanup, Collision Callbacks, and Constraint Management

---

## Overview

This document provides guidance for reviewing Matter.js implementations in game components. Common performance issues and best practices are outlined below.

---

## 1. Engine Initialization Patterns

### Critical Issue: Engine Re-initialization Every Render

**Problem:**
```tsx
// ❌ BAD - Creates new engine on every render
useEffect(() => {
  const engine = Matter.Engine.create();
  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);

  return () => {
    Matter.Runner.stop(runner);
    Matter.Engine.clear(engine);
  };
}); // No dependency array!
```

**Impact:**
- Engine destroyed and recreated constantly
- Physics state reset every render
- Bodies lose their state
- Severe performance degradation

**Solution:**
```tsx
// ✅ GOOD - Engine created once
useEffect(() => {
  const engine = Matter.Engine.create();
  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  engineRef.current = engine;

  return () => {
    Matter.Runner.stop(runner);
    Matter.Engine.clear(engine);
  };
}, []); // Empty dependency array - runs once on mount
```

---

### Pattern Review: Engine Setup

**Checklist:**
- [ ] Engine created with empty `[]` dependency array
- [ ] Engine instance stored in `useRef` for access across renders
- [ ] Runner stopped in cleanup function
- [ ] `Engine.clear()` called to remove all bodies/constraints
- [ ] No engine recreation in loops or state updates

---

## 2. Body Cleanup Between Rounds

### Critical Issue: Bodies Not Removed from World

**Problem:**
```tsx
// ❌ BAD - Bodies accumulate in world
const createBodies = () => {
  const ground = Matter.Bodies.rectangle(400, 580, 800, 60, { isStatic: true });
  const ball = Matter.Bodies.circle(100, 100, 15);
  Matter.World.add(engine.current.world, [ground, ball]);

  // Bodies never removed!
};

// When game restarts, createBodies called again but old bodies stay in world
const handleRestart = () => {
  createBodies(); // ❌ Old bodies still exist
};
```

**Impact:**
- Memory leak: old bodies remain in physics world
- Physics simulation calculates collisions with invisible bodies
- Performance degrades dramatically each round
- CPU usage increases by ~2x per uncleared round

**Solution:**
```tsx
// ✅ GOOD - Clean removal before adding new bodies
const bodiesRef = useRef([]);

const clearBodies = useCallback(() => {
  if (bodiesRef.current.length > 0) {
    Matter.World.remove(engine.current.world, bodiesRef.current);
    bodiesRef.current = [];
  }
}, []);

const createBodies = useCallback(() => {
  clearBodies(); // Clear old bodies first

  const ground = Matter.Bodies.rectangle(400, 580, 800, 60, { isStatic: true });
  const ball = Matter.Bodies.circle(100, 100, 15);
  const newBodies = [ground, ball];

  Matter.World.add(engine.current.world, newBodies);
  bodiesRef.current = newBodies;
}, [clearBodies]);

// Cleanup on unmount
useEffect(() => {
  return () => clearBodies();
}, [clearBodies]);
```

---

### Best Practice: Constraint Cleanup

**Problem:**
```tsx
// ❌ BAD - Constraints left in world
const addConstraint = () => {
  const constraint = Matter.Constraint.create({
    bodyA: bodyA,
    bodyB: bodyB,
    length: 50
  });
  Matter.World.add(engine.current.world, constraint);
  // Never removed!
};
```

**Solution:**
```tsx
// ✅ GOOD - Track and cleanup constraints
const constraintsRef = useRef([]);

const addConstraint = useCallback((bodyA, bodyB) => {
  const constraint = Matter.Constraint.create({
    bodyA: bodyA,
    bodyB: bodyB,
    length: 50,
    stiffness: 0.8
  });
  Matter.World.add(engine.current.world, constraint);
  constraintsRef.current.push(constraint);
}, []);

const clearConstraints = useCallback(() => {
  if (constraintsRef.current.length > 0) {
    Matter.World.remove(engine.current.world, constraintsRef.current);
    constraintsRef.current = [];
  }
}, []);
```

---

## 3. Collision Callbacks: Function Instance Management

### Critical Issue: New Function on Every Frame

**Problem:**
```tsx
// ❌ BAD - Creates new handler function every render
useEffect(() => {
  const handleCollision = (event) => {
    const pairs = event.pairs;
    pairs.forEach(pair => {
      if (hasCollided(pair.bodyA, pair.bodyB)) {
        handleImpact(pair);
      }
    });
  };

  Matter.Events.on(engine.current, 'beforeUpdate', handleCollision);
  // No cleanup of old handler!
}, [gameState]); // Recreates on every state change
```

**Impact:**
- Event handler added multiple times (memory leak)
- Old handlers still execute
- Multiple collision detections per frame
- CPU usage grows with every state update
- Potential for duplicate collision effects

**Solution:**
```tsx
// ✅ GOOD - Single event handler with proper cleanup
const handleCollisionRef = useRef(null);

useEffect(() => {
  const handleCollision = (event) => {
    const pairs = event.pairs;
    pairs.forEach(pair => {
      if (hasCollided(pair.bodyA, pair.bodyB)) {
        handleImpact(pair);
      }
    });
  };

  // Store reference for cleanup
  handleCollisionRef.current = handleCollision;

  // Add event listener once
  Matter.Events.on(engine.current, 'beforeUpdate', handleCollision);

  // Cleanup: Remove old handler before adding new one
  return () => {
    if (handleCollisionRef.current) {
      Matter.Events.off(engine.current, 'beforeUpdate', handleCollisionRef.current);
    }
  };
}, []); // Empty array - only runs once
```

---

### Pattern: Collision Detection Best Practice

**Safe Pattern:**
```tsx
// Use a ref to keep current game state without recreating callback
const gameStateRef = useRef(gameState);

useEffect(() => {
  gameStateRef.current = gameState;
}, [gameState]);

// Collision handler defined once, reads current state from ref
useEffect(() => {
  const handleCollision = (event) => {
    const pairs = event.pairs;
    pairs.forEach(pair => {
      // Can safely access gameStateRef.current without recreating function
      if (gameStateRef.current.isPlaying) {
        handleImpact(pair);
      }
    });
  };

  Matter.Events.on(engine.current, 'beforeUpdate', handleCollision);

  return () => {
    Matter.Events.off(engine.current, 'beforeUpdate', handleCollision);
  };
}, []); // Never recreates - reads state via ref
```

---

## 4. Constraint Updates: Avoiding Frame-by-Frame Recreation

### Critical Issue: Recreating Constraints Every Frame

**Problem:**
```tsx
// ❌ BAD - Updates constraints every render/frame
const update = () => {
  // Remove old constraint
  Matter.World.remove(engine.current.world, constraint);

  // Create new one with new position
  const newConstraint = Matter.Constraint.create({
    bodyA: bodyA,
    bodyB: bodyB,
    pointA: { x: mouseX, y: mouseY },
    length: 0
  });
  Matter.World.add(engine.current.world, newConstraint);
};

// Called every frame in loop
requestAnimationFrame(update);
```

**Impact:**
- Constraints destroyed and recreated constantly
- Garbage collection pressure increases
- Physics simulation becomes unstable
- High CPU usage

**Solution:**
```tsx
// ✅ GOOD - Modify constraint properties instead of recreating
const constraintRef = useRef(null);

useEffect(() => {
  // Create constraint once
  constraintRef.current = Matter.Constraint.create({
    bodyA: bodyA,
    bodyB: bodyB,
    stiffness: 0.8,
    label: 'mouse-constraint'
  });
  Matter.World.add(engine.current.world, constraintRef.current);

  return () => {
    if (constraintRef.current) {
      Matter.World.remove(engine.current.world, constraintRef.current);
    }
  };
}, []);

// Update constraint properties without recreating
const updateMouseConstraint = useCallback((x, y) => {
  if (constraintRef.current) {
    // Modify, don't recreate
    constraintRef.current.pointA = { x, y };
    // Optionally update length
    constraintRef.current.length = 0;
  }
}, []);

// Call updateMouseConstraint from mouse move, not recreating
useEffect(() => {
  const handleMouseMove = (event) => {
    updateMouseConstraint(event.clientX, event.clientY);
  };

  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, [updateMouseConstraint]);
```

---

## 5. Step Function Optimization

### Pattern: beforeUpdate vs afterUpdate

**Understanding Event Order:**
```
beforeUpdate → Physics calculation → afterUpdate
```

**Best Practice:**
```tsx
// ✅ GOOD - Use appropriate event for task
useEffect(() => {
  // Use beforeUpdate for input/force application (affects this frame's physics)
  const handleBeforeUpdate = () => {
    if (inputRef.current.jump && bodyRef.current) {
      Matter.Body.setVelocity(bodyRef.current, { x: 0, y: -20 });
      inputRef.current.jump = false;
    }
  };

  // Use afterUpdate for state updates (reads results of physics)
  const handleAfterUpdate = () => {
    updateUI({
      position: bodyRef.current.position,
      velocity: bodyRef.current.velocity
    });
  };

  Matter.Events.on(engine.current, 'beforeUpdate', handleBeforeUpdate);
  Matter.Events.on(engine.current, 'afterUpdate', handleAfterUpdate);

  return () => {
    Matter.Events.off(engine.current, 'beforeUpdate', handleBeforeUpdate);
    Matter.Events.off(engine.current, 'afterUpdate', handleAfterUpdate);
  };
}, []);
```

---

## 6. Complete Cleanup Checklist

### On Component Unmount or Round End

```tsx
const cleanup = useCallback(() => {
  // 1. Remove all bodies
  if (bodiesRef.current.length > 0) {
    Matter.World.remove(engine.current.world, bodiesRef.current);
    bodiesRef.current = [];
  }

  // 2. Remove all constraints
  if (constraintsRef.current.length > 0) {
    Matter.World.remove(engine.current.world, constraintsRef.current);
    constraintsRef.current = [];
  }

  // 3. Remove all event listeners
  Matter.Events.off(engine.current, 'beforeUpdate');
  Matter.Events.off(engine.current, 'afterUpdate');
  Matter.Events.off(engine.current, 'collisionStart');
  Matter.Events.off(engine.current, 'collisionEnd');

  // 4. Clear world (safety measure)
  Matter.World.clear(engine.current.world, false);

  // 5. Stop engine
  Matter.Runner.stop(runnerRef.current);

  // 6. Clear all references
  engineRef.current = null;
  runnerRef.current = null;
}, []);

useEffect(() => {
  return cleanup; // Call on unmount
}, [cleanup]);
```

---

## 7. Performance Monitoring

### Red Flags to Watch For

1. **Memory growth over time** - Indicates bodies/constraints not cleaned up
2. **Frame rate drop** - Too many bodies or collision pairs
3. **Event handler stack** - Multiple handlers for same event
4. **Constraint instability** - Flickering or jittering bodies

### Debugging Commands

```tsx
// Check active bodies in world
console.log('Active bodies:', engine.current.world.bodies.length);

// Check constraints
console.log('Active constraints:', engine.current.world.constraints.length);

// Check event listeners (no built-in API, but ref-tracking helps)
console.log('Tracked bodies:', bodiesRef.current.length);
console.log('Tracked constraints:', constraintsRef.current.length);

// Monitor frame rate
console.time('Physics step');
Matter.Engine.update(engine.current);
console.timeEnd('Physics step');
```

---

## 8. Common Game Component Patterns

### Snake Game Pattern

**Issue to Check:**
- New segments created each round - are old ones cleaned?
- Collision detection called per segment - how many handlers?
- Any body position updates in render loop?

**Audit Questions:**
1. Does `useEffect` with `[]` create engine?
2. When round restarts, are all bodies removed?
3. Are collision handlers added only once?
4. Are positions updated via physics or direct body manipulation?

---

### Gravity Ball Pattern

**Issue to Check:**
- Marble physics - bodies recreated on reset?
- Goal collision - handler registered multiple times?
- Tilting causes constraint updates - are constraints recreated?

**Audit Questions:**
1. Is tilt input applied via forces or direct manipulation?
2. Are goal trigger zones recreated each frame?
3. How are collisions detected - custom or native?

---

### Slope Rider Pattern

**Issue to Check:**
- Terrain bodies - how many? Recreated each round?
- Camera follows character - physics-based or manual?
- Obstacle collisions - per-obstacle handlers?

**Audit Questions:**
1. Is terrain procedurally generated - memory impact?
2. Are off-screen bodies removed from world?
3. How many active collision handlers?

---

## 9. Optimization Techniques

### Spatial Partitioning (for many bodies)

```tsx
// If you have 100+ bodies, Matter.Engine has built-in broadphase
// But monitor with:
console.log('Broad-phase pairs:', engine.current.broadphase.pairsList.length);

// Consider disabling collision for non-critical pairs
staticBody.collisionFilter.category = 0x0002;
dynamicBody.collisionFilter.mask = 0x0001; // Won't collide with category 0x0002
```

---

### Sleeping Bodies

```tsx
// Enable sleeping to reduce calculations
engine.current.enableSleeping = true;

// Sleeping can be disabled per-body
Matter.Body.setSleeping(body, false);
```

---

### Fixed Timestep

```tsx
// Use fixed timestep for consistent physics
const deltaTime = 1000 / 60; // 60 FPS
Matter.Engine.update(engine.current, deltaTime);
```

---

## 10. Audit Template

Use this checklist when reviewing a Matter.js game component:

### Initialization
- [ ] Engine created with `useEffect(..., [])`
- [ ] Engine stored in `useRef`
- [ ] Runner created and stored
- [ ] No conditional engine creation

### Body Management
- [ ] Bodies tracked in `useRef` array
- [ ] `clearBodies()` called before adding new bodies
- [ ] `World.remove()` called with body array
- [ ] Cleanup function removes all bodies

### Collision Handling
- [ ] Collision handler defined once (not in state-dependent effect)
- [ ] Event listeners removed in cleanup
- [ ] No multiple handlers for same event
- [ ] Current state accessed via ref, not closure

### Constraints
- [ ] Constraints tracked in `useRef`
- [ ] Properties modified, not recreated
- [ ] All constraints removed in cleanup
- [ ] Stiffness/length set appropriately

### Cleanup
- [ ] Component unmount cleanup removes:
  - [ ] All bodies
  - [ ] All constraints
  - [ ] All event listeners
  - [ ] Runner and engine
- [ ] No lingering references
- [ ] World.clear() called if needed

### Performance
- [ ] No memory growth over time
- [ ] Consistent frame rate
- [ ] Reasonable body count (<500)
- [ ] No visible jittering/instability

---

## Resources

- [Matter.js Documentation](https://brm.io/matter-js/)
- [Matter.js Examples](https://github.com/liabru/matter-js/tree/master/examples)
- [React + Matter.js Best Practices](https://dev.to/jmrashed/react-and-matterjs-22e8)

---

## Summary

**Critical Points:**
1. ✅ Engine created once on mount, never recreated
2. ✅ Bodies/constraints removed before creating new ones
3. ✅ Collision handlers added once, use refs for state
4. ✅ Constraints modified, not recreated
5. ✅ Complete cleanup on unmount

**Expected Performance:**
- Smooth 60 FPS during gameplay
- No memory growth over multiple rounds
- Consistent collision detection
- Responsive input handling

**Red Flags:**
- ❌ Engine recreating each render
- ❌ Bodies accumulating in world
- ❌ New collision handlers each state update
- ❌ Constraints recreated every frame
- ❌ Memory usage increasing over time
