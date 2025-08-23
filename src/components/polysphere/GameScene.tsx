import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { LevelConfig } from './levels'
import { generateShardsFromPath, randomScatterTransform } from './shard'
import { quatAngleDeg, useTargetQuaternion } from './useCoherence'

type Props = { level: LevelConfig; onNext: () => void }

export default function GameScene({ level, onNext }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [coherence, setCoherence] = useState(0)
  const [complete, setComplete] = useState(false)

  const targetQ = useTargetQuaternion(level.targetQuaternion)

  const shardsData = useMemo(() => {
    const geoms = generateShardsFromPath(level.svgPath, level.shardCount)
    const colors = level.palette
    const data = geoms.map((g, i) => {
      const color = new THREE.Color(colors[i % colors.length])
      const { pos, quat } = randomScatterTransform()
      return { geom: g, color, initPos: pos, initQuat: quat }
    })
    return data
  }, [level])

  useEffect(() => {
    if (!mountRef.current) return

    const container = mountRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d0f14')

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 3.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const light = new THREE.AmbientLight(0xffffff, 0.9)
    scene.add(light)
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(1, 1, 2)
    scene.add(dir)

    // Silhouette hint plane
    const hintGroup = new THREE.Group()
    const hintGeom = new THREE.ShapeGeometry(new THREE.Shape())
    // Instead of real geometry above, render with canvas texture for simplicity:
    const c = document.createElement('canvas')
    c.width = 512; c.height = 512
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.08
    ctx.translate(256, 256)
    ctx.scale(1.8, -1.8)
    // Redraw the path as polygon
    const pathTokens = level.svgPath.trim().split(/\s+/)
    let i = 0
    while (i < pathTokens.length) {
      const t = pathTokens[i++]
      if (t === 'M' || t === 'L') {
        const x = parseFloat(pathTokens[i++])
        const y = parseFloat(pathTokens[i++])
        if (t === 'M') ctx.beginPath()
        ctx.lineTo(x, y)
      } else if (t === 'Z' || t === 'z') {
        ctx.closePath()
        ctx.fill()
      } else if (!isNaN(parseFloat(t))) {
        const x = parseFloat(t)
        const y = parseFloat(pathTokens[i++])
        ctx.lineTo(x, y)
      }
    }
    const hintTex = new THREE.CanvasTexture(c)
    const hintMat = new THREE.MeshBasicMaterial({ map: hintTex, transparent: true, depthWrite: false })
    const hintPlane = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), hintMat)
    hintPlane.position.z = -0.2
    hintGroup.add(hintPlane)
    scene.add(hintGroup)

    // Shards group
    const group = new THREE.Group()
    scene.add(group)

    shardsData.forEach(({ geom, color, initPos, initQuat }) => {
      // Create materials for each face of the cube
      const materials = [
        new THREE.MeshLambertMaterial({ color: 0x808080 }), // Right face - Gray
        new THREE.MeshLambertMaterial({ color: 0x808080 }), // Left face - Gray
        new THREE.MeshLambertMaterial({ color: 0x808080 }), // Top face - Gray
        new THREE.MeshLambertMaterial({ color: 0x808080 }), // Bottom face - Gray
        new THREE.MeshLambertMaterial({ color: 0xffff00 }), // Front face - YELLOW (target face)
        new THREE.MeshLambertMaterial({ color: 0x808080 })  // Back face - Gray
      ]
      const mat = materials
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(initPos)
      mesh.quaternion.copy(initQuat)
      group.add(mesh)
    })

    // Drag rotation controls
    let isDown = false
    let lastX = 0, lastY = 0
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) // Start rotated 90 degrees

    const onDown = (e: PointerEvent) => {
      isDown = true
      lastX = e.clientX
      lastY = e.clientY
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!isDown) return
      const dx = (e.clientX - lastX) / container.clientWidth
      const dy = (e.clientY - lastY) / container.clientHeight
      lastX = e.clientX
      lastY = e.clientY
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * Math.PI)
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * Math.PI)
      rot.multiply(qx).multiply(qy)
    }
    const onUp = (e: PointerEvent) => {
      isDown = false
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointerleave', onUp)

    // Animation loop
    let raf = 0
    let solvedHold = 0
    const tolerance = level.toleranceDeg
    const tmpQ = new THREE.Quaternion()

    const tick = (t: number) => {
      // Inertia damping to smooth motion
      group.quaternion.slerp(rot, 0.15)

      // Compute coherence from quaternion angle
      tmpQ.copy(group.quaternion).normalize()
      const angle = quatAngleDeg(tmpQ, targetQ)
      const coh = Math.max(0, 1 - angle / 90) // map 0..90deg to 1..0
      setCoherence(coh)

      // Fade hint as coherence rises
      hintMat.opacity = 0.15 * (1 - coh)

      // Snap complete after threshold sustained
      if (!complete) {
        if (angle <= tolerance) {
          solvedHold += 16
          if (solvedHold > 200) {
            // animate shards snapping flat
            setComplete(true)
          }
        } else {
          solvedHold = 0
        }
      } else {
        // ease to exact target
        group.quaternion.slerp(targetQ, 0.2)
        // gently move shards toward z=0 plane
        group.children.forEach((m) => {
          const mesh = m as THREE.Mesh
          mesh.position.lerp(new THREE.Vector3(0,0,0), 0.12)
          mesh.quaternion.slerp(new THREE.Quaternion(), 0.12)
        })
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointerleave', onUp)
      container.removeChild(renderer.domElement)
      scene.traverse(obj => {
        if ((obj as any).geometry) (obj as any).geometry.dispose?.()
        if ((obj as any).material) {
          const m = (obj as any).material
          if (Array.isArray(m)) m.forEach(mm => mm.dispose?.())
          else m.dispose?.()
        }
      })
      renderer.dispose()
    }
  }, [level, shardsData, targetQ, complete])

  return (
    <div>
      <div className="scene-wrap" ref={mountRef}>
        <div className="hud">
          <div className="meter">
            <div className="fill" style={{ width: `${Math.round(coherence * 100)}%` }} />
          </div>
          {complete ? (
            <div className="complete">
              <div>Solved!</div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button onClick={onNext}>Back to Levels</button>
              </div>
            </div>
          ) : (
            <div className="tip">Drag to rotate. Get the yellow face pointing forward!</div>
          )}
        </div>
      </div>
      
      {/* Quit button below the game area */}
      {!complete && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={onNext} style={{ 
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}>
            Back to Levels
          </button>
        </div>
      )}
      </div>
  )
}