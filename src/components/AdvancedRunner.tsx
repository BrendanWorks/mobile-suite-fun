import React, { useRef, useEffect, useState } from 'react'
import useSwipeControls from '../hooks/useSwipeControls'
import objectPool from '../pools/objectPool'

type Props = {
  width?: number
  height?: number
  onGameOver?: (score: number) => void
}

export default function AdvancedRunner({ 
  width = 800, 
  height = 600, 
  onGameOver 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<any>()
  const renderRef = useRef<any>()
  const lastSpawn = useRef(0)
  const rafId = useRef<number>()
  const scoreRef = useRef(0)
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu')
  const [score, setScore] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Swipe or tap → apply force to the player body
  useSwipeControls((dir) => {
    if (gameState !== 'playing') return
    
    const player = objectPool.acquire('player')
    if (player && engineRef.current) {
      const Matter = (window as any).Matter
      let force = { x: 0, y: 0 }
      
      switch (dir) {
        case 'up':
          force = { x: 0, y: -0.04 }
          break
        case 'down':
          force = { x: 0, y: 0.02 }
          break
        case 'left':
          force = { x: -0.02, y: 0 }
          break
        case 'right':
          force = { x: 0.02, y: 0 }
          break
      }
      
      if (!engineRef.current.world.bodies.includes(player)) {
        Matter.World.add(engineRef.current.world, player)
      }
      Matter.Body.applyForce(player, player.position, force)
    }
  })

  const startGame = async () => {
    setIsLoading(true)
    setGameState('playing')
    setScore(0)
    scoreRef.current = 0
    
    try {
      await setup()
    } catch (error) {
      console.error('Failed to start game:', error)
      setGameState('menu')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGameOver = (finalScore: number) => {
    setGameState('gameOver')
    setScore(finalScore)
    onGameOver?.(finalScore)
    
    // Cleanup
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }
    objectPool.clear()
  }

  const resetGame = () => {
    setGameState('menu')
    setScore(0)
    scoreRef.current = 0
    
    // Cleanup
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }
    if (engineRef.current && renderRef.current) {
      const Matter = (window as any).Matter
      Matter.Render.stop(renderRef.current)
      Matter.World.clear(engineRef.current.world, false)
      Matter.Engine.clear(engineRef.current)
    }
    objectPool.clear()
  }

  async function setup() {
    if (!containerRef.current) return

    let spawnInterval = 1500 // ms
    let lastTime = performance.now()

    // 1. Load and init Matter
    const Matter = await import('matter-js')
    const engine = Matter.Engine.create()
    const world = engine.world
    
    // Set gravity
    world.gravity.y = 1

    // 2. Attach to refs
    engineRef.current = engine

    // 3. Create ground
    const ground = Matter.Bodies.rectangle(width / 2, height - 50, width, 100, {
      isStatic: true,
      render: { fillStyle: '#8B4513' },
      label: 'ground'
    })
    Matter.World.add(world, ground)

    // 4. Init renderer
    const render = Matter.Render.create({
      element: containerRef.current,
      engine,
      options: { 
        width, 
        height, 
        wireframes: false,
        background: '#87CEEB',
        showAngleIndicator: false,
        showVelocity: false
      },
    })
    renderRef.current = render
    Matter.Render.run(render)

    // 5. Init object pool with Matter & world
    objectPool.initialize(Matter, world)

    // 6. Add initial player
    const player = objectPool.acquire('player')
    if (player) {
      Matter.World.add(world, player)
    }

    // 7. Kick off the main loop
    rafId.current = requestAnimationFrame(loop)

    function loop(time: number) {
      if (gameState !== 'playing') return

      const engine = engineRef.current!
      const Matter = (window as any).Matter

      // delta-step physics
      const delta = time - lastTime
      Matter.Engine.update(engine, delta)
      lastTime = time

      // spawn obstacles
      if (time - lastSpawn.current > spawnInterval) {
        const obstacleType = Math.random() > 0.5 ? 'rolling' : 'ground'
        const obstacle = objectPool.acquire(obstacleType)
        if (obstacle) {
          Matter.World.add(engine.world, obstacle)
        }
        lastSpawn.current = time
        
        // Increase score
        scoreRef.current += 10
        setScore(scoreRef.current)
        
        // Increase difficulty
        if (spawnInterval > 800) {
          spawnInterval -= 10
        }
      }

      // prune off-screen
      objectPool.reclaimOffscreen(width, height)

      // game-over check (simplified)
      if (objectPool.checkCollision('player', 'ground') || 
          objectPool.checkCollision('player', 'rolling')) {
        handleGameOver(scoreRef.current)
        return
      }

      // loop again
      rafId.current = requestAnimationFrame(loop)
    }
  }

  useEffect(() => {
    return () => {
      // teardown on unmount
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
      if (engineRef.current && renderRef.current) {
        const Matter = (window as any).Matter
        if (Matter) {
          Matter.Render.stop(renderRef.current)
          Matter.World.clear(engineRef.current.world, false)
          Matter.Engine.clear(engineRef.current)
        }
      }
      objectPool.clear()
    }
  }, [])

  if (gameState === 'menu') {
    return (
      <div className="text-center max-w-4xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-screen flex flex-col justify-center">
        <h1 className="text-6xl font-bold mb-4">Advanced Runner</h1>
        <p className="text-xl mb-4 opacity-90">New modular architecture with object pooling!</p>
        <p className="text-lg mb-4 opacity-75">Swipe controls with physics-based movement</p>
        <p className="text-md mb-8 opacity-60">Optimized performance with reusable objects</p>
        <button 
          onClick={startGame}
          disabled={isLoading}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xl transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Start Game'}
        </button>
        
        <div className="mt-8 pt-4 border-t border-white border-opacity-20">
          <p className="text-sm opacity-50">Advanced Runner v2.0.0</p>
          <p className="text-xs opacity-40">Modular • Object Pooling • Hook-based Controls</p>
        </div>
      </div>
    )
  }

  if (gameState === 'gameOver') {
    return (
      <div className="text-center max-w-4xl mx-auto p-6 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl text-white min-h-screen flex flex-col justify-center">
        <h1 className="text-4xl font-bold mb-4">Game Over!</h1>
        <p className="text-2xl mb-4">Final Score: {score}</p>
        <div className="space-y-4">
          <button 
            onClick={startGame}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xl transition-colors mr-4"
          >
            Play Again
          </button>
          <button 
            onClick={resetGame}
            className="px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg text-xl transition-colors"
          >
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center">
      <div className="relative">
        <div 
          ref={containerRef} 
          style={{ width, height }}
          className="border border-gray-600 rounded-lg overflow-hidden"
        />
        
        {/* HUD */}
        <div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 p-3 rounded-lg">
          <div className="font-bold">Advanced Runner v2.0</div>
          <div className="text-sm opacity-80">Score: {score}</div>
          <div className="text-xs opacity-60">
            Objects: {objectPool.getActiveCount()}
          </div>
        </div>

        {/* Controls Info */}
        <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 p-3 rounded-lg">
          <div className="text-xs font-bold mb-2">Touch Controls:</div>
          <div className="text-xs opacity-80">Swipe Up: Jump</div>
          <div className="text-xs opacity-80">Swipe Down: Crouch</div>
          <div className="text-xs opacity-80">Swipe Left/Right: Dash</div>
          <div className="text-xs opacity-80">Tap: Jump</div>
        </div>
        
        {/* Back Button */}
        <div className="absolute top-4 right-4">
          <button 
            onClick={resetGame}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  )
}