import * as THREE from 'three'

export interface LevelConfig {
  id: string;
  name: string;
  svgPath: string;
  shardCount: number;
  palette: string[];
  targetQuaternion?: THREE.Quaternion;
  toleranceDeg: number;
}

export const LEVELS: LevelConfig[] = [
  {
    id: "heart",
    name: "Test Cube",
    svgPath: "M -50 -50 L 50 -50 L 50 50 L -50 50 Z",
    shardCount: 1,
    palette: ["#808080"],
    targetQuaternion: new THREE.Quaternion(), // Identity quaternion - yellow face forward to win
    toleranceDeg: 25
  },
  {
    id: "star",
    name: "Star", 
    svgPath: "M -60 0 L -45 -10 L -30 0 L -15 -10 L 0 0 L 15 -10 L 30 0 L 45 -10 L 60 0 L 45 10 L 30 0 L 15 10 L 0 0 L -15 10 L -30 0 L -45 10 Z",
    shardCount: 5,
    palette: ["#f9ca24", "#f0932b", "#eb4d4b"],
    targetQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4),
    toleranceDeg: 30
  },
  {
    id: "diamond",
    name: "Diamond",
    svgPath: "M 0 -40 L 30 0 L 0 40 L -30 0 Z",
    shardCount: 8,
    palette: ["#4ecdc4", "#45b7d1", "#96ceb4"],
    targetQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 6),
    toleranceDeg: 12
  },
  {
    id: "flower",
    name: "Flower",
    svgPath: "M 0 -25 C 15 -35 35 -15 25 0 C 35 15 15 35 0 25 C -15 35 -35 15 -25 0 C -35 -15 -15 -35 0 -25 Z",
    shardCount: 10,
    palette: ["#fd79a8", "#fdcb6e", "#6c5ce7"],
    targetQuaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3),
    toleranceDeg: 9
  }
]