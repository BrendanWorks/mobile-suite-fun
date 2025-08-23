import React, { useState } from 'react'
import { LEVELS, LevelConfig } from './polysphere/levels'
import GameScene from './polysphere/GameScene'
import './polysphere/styles.css' // keep the styles

export default function PolysphereGame() {
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null)

  return (
    <div className="polysphere-wrapper">
      {!currentLevel ? (
        <div className="home">
          <h1>Polysphere</h1>
          <p>Rotate the pieces until the picture snaps into place.</p>
          <div className="grid">
            {LEVELS.map(l => (
              <button
                key={l.id}
                className="card"
                onClick={() => setCurrentLevel(l)}
              >
                <span className="card-title">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <GameScene
          level={currentLevel}
          onNext={() => setCurrentLevel(null)}
        />
      )}
    </div>
  )
}