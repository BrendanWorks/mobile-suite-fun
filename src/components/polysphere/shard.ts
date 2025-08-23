import * as THREE from 'three'

export function generateShardsFromPath(svgPath: string, shardCount: number): THREE.BufferGeometry[] {
  const shards: THREE.BufferGeometry[] = []
  
  for (let i = 0; i < shardCount; i++) {
    // Create a simple cube geometry
    const cubeGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)
    shards.push(cubeGeometry)
  }
  
  return shards
}

export function randomScatterTransform() {
  // Generate random position and rotation for scattered pieces
  const pos = new THREE.Vector3(
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2
  )
  
  const quat = new THREE.Quaternion()
  // Start with yellow face pointing to the right (90 degrees around Y-axis)
  quat.setFromEuler(new THREE.Euler(
    0,
    Math.PI / 2, // 90 degrees around Y - yellow face to the right
    0
  ))
  
  return { pos, quat }
}