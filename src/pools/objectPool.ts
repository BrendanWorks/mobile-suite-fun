import * as Matter from 'matter-js'

type ObjectType = 'player' | 'ground' | 'rolling' | 'flying'

interface PooledObject {
  body: Matter.Body
  type: ObjectType
  inUse: boolean
}

class ObjectPool {
  private Matter: typeof Matter | null = null
  private world: Matter.World | null = null
  private pools: Map<ObjectType, PooledObject[]> = new Map()
  private activeObjects: PooledObject[] = []

  initialize(MatterJS: typeof Matter, world: Matter.World) {
    this.Matter = MatterJS
    this.world = world
    this.initializePools()
  }

  private initializePools() {
    if (!this.Matter || !this.world) return

    // Initialize player pool (usually just 1)
    const playerPool: PooledObject[] = []
    const playerBody = this.Matter.Bodies.rectangle(100, 300, 40, 40, {
      render: { fillStyle: '#ff6b6b' },
      label: 'player',
      frictionAir: 0.01,
      friction: 0.8
    })
    playerPool.push({ body: playerBody, type: 'player', inUse: false })
    this.pools.set('player', playerPool)

    // Initialize ground obstacles pool
    const groundPool: PooledObject[] = []
    for (let i = 0; i < 10; i++) {
      const groundBody = this.Matter.Bodies.rectangle(-100, -100, 30, 60, {
        render: { fillStyle: '#e74c3c' },
        label: 'ground',
        isStatic: true
      })
      groundPool.push({ body: groundBody, type: 'ground', inUse: false })
    }
    this.pools.set('ground', groundPool)

    // Initialize rolling obstacles pool
    const rollingPool: PooledObject[] = []
    for (let i = 0; i < 10; i++) {
      const rollingBody = this.Matter.Bodies.circle(-100, -100, 20, {
        render: { fillStyle: '#ffa500' },
        label: 'rolling',
        restitution: 0.3,
        friction: 0.8,
        frictionAir: 0.01,
        density: 0.002
      })
      rollingPool.push({ body: rollingBody, type: 'rolling', inUse: false })
    }
    this.pools.set('rolling', rollingPool)

    // Initialize flying obstacles pool
    const flyingPool: PooledObject[] = []
    for (let i = 0; i < 8; i++) {
      const flyingBody = this.Matter.Bodies.circle(-100, -100, 20, {
        render: { fillStyle: '#9b59b6' },
        label: 'flying',
        frictionAir: 0.01,
        restitution: 0.3,
        density: 0.001
      })
      flyingPool.push({ body: flyingBody, type: 'flying', inUse: false })
    }
    this.pools.set('flying', flyingPool)
  }

  acquire(type: ObjectType): Matter.Body | null {
    const pool = this.pools.get(type)
    if (!pool || !this.Matter || !this.world) return null

    // Find an unused object
    const available = pool.find(obj => !obj.inUse)
    if (!available) return null

    available.inUse = true
    this.activeObjects.push(available)

    // Position the object based on type
    switch (type) {
      case 'player':
        this.Matter.Body.setPosition(available.body, { x: 100, y: 300 })
        break
      case 'ground':
        this.Matter.Body.setPosition(available.body, { x: 800, y: 450 })
        this.Matter.Body.setVelocity(available.body, { x: -4, y: 0 })
        break
      case 'rolling':
        this.Matter.Body.setPosition(available.body, { x: 800, y: 430 })
        this.Matter.Body.setVelocity(available.body, { x: -6, y: 0 })
        this.Matter.Body.setAngularVelocity(available.body, -0.15)
        break
      case 'flying':
        const flyY = 300 + Math.random() * 100
        this.Matter.Body.setPosition(available.body, { x: 800, y: flyY })
        this.Matter.Body.setVelocity(available.body, { x: -3, y: Math.random() * 2 - 1 })
        break
    }

    return available.body
  }

  release(body: Matter.Body) {
    if (!this.Matter || !this.world) return

    const index = this.activeObjects.findIndex(obj => obj.body === body)
    if (index === -1) return

    const obj = this.activeObjects[index]
    obj.inUse = false

    // Move off-screen and reset
    this.Matter.Body.setPosition(obj.body, { x: -100, y: -100 })
    this.Matter.Body.setVelocity(obj.body, { x: 0, y: 0 })
    this.Matter.Body.setAngularVelocity(obj.body, 0)

    // Remove from world
    this.Matter.World.remove(this.world, body)

    // Remove from active objects
    this.activeObjects.splice(index, 1)
  }

  reclaimOffscreen(width: number, height: number) {
    if (!this.Matter || !this.world) return

    const toReclaim: Matter.Body[] = []

    this.activeObjects.forEach(obj => {
      const pos = obj.body.position
      if (pos.x < -100 || pos.x > width + 100 || pos.y > height + 100) {
        toReclaim.push(obj.body)
      }
    })

    toReclaim.forEach(body => this.release(body))
  }

  checkCollision(typeA: ObjectType, typeB: ObjectType): boolean {
    const objectsA = this.activeObjects.filter(obj => obj.type === typeA)
    const objectsB = this.activeObjects.filter(obj => obj.type === typeB)

    for (const objA of objectsA) {
      for (const objB of objectsB) {
        const distance = this.getDistance(objA.body.position, objB.body.position)
        const minDistance = this.getMinDistance(objA.body, objB.body)
        
        if (distance < minDistance) {
          return true
        }
      }
    }

    return false
  }

  private getDistance(posA: Matter.Vector, posB: Matter.Vector): number {
    const dx = posA.x - posB.x
    const dy = posA.y - posB.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getMinDistance(bodyA: Matter.Body, bodyB: Matter.Body): number {
    // Simple approximation - in a real implementation you'd use proper collision detection
    const radiusA = bodyA.circleRadius || Math.max(bodyA.bounds.max.x - bodyA.bounds.min.x, bodyA.bounds.max.y - bodyA.bounds.min.y) / 2
    const radiusB = bodyB.circleRadius || Math.max(bodyB.bounds.max.x - bodyB.bounds.min.x, bodyB.bounds.max.y - bodyB.bounds.min.y) / 2
    return (radiusA + radiusB) * 0.8 // Allow some overlap tolerance
  }

  getActiveCount(type?: ObjectType): number {
    if (type) {
      return this.activeObjects.filter(obj => obj.type === type).length
    }
    return this.activeObjects.length
  }

  clear() {
    if (!this.Matter || !this.world) return

    // Release all active objects
    const toRelease = [...this.activeObjects]
    toRelease.forEach(obj => this.release(obj.body))

    this.activeObjects = []
  }
}

// Export singleton instance
const objectPool = new ObjectPool()
export default objectPool