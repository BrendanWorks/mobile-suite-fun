import { useMemo } from 'react'
import * as THREE from 'three'

export function quatAngleDeg(q1: THREE.Quaternion, q2: THREE.Quaternion): number {
  // Calculate angle between two quaternions in degrees
  const dot = Math.abs(q1.dot(q2))
  const angle = 2 * Math.acos(Math.min(1, dot))
  return (angle * 180) / Math.PI
}

export function useTargetQuaternion(targetQuat?: THREE.Quaternion): THREE.Quaternion {
  return useMemo(() => {
    if (targetQuat) {
      return targetQuat.clone()
    }
    // Default target quaternion (identity)
    return new THREE.Quaternion()
  }, [targetQuat])
}