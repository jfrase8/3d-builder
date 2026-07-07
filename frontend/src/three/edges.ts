import * as THREE from 'three'
import { keyOf } from '../types'

// A unit cube spans [x, x+1] on each axis. An edge of the merged structure
// should be drawn only if it is NOT shared by two coplanar exposed faces —
// i.e. it lies on the silhouette / outer boundary of the solid.
//
// Cheap, correct heuristic for axis-aligned voxels: an edge belongs to 4
// cells that surround it (the 4 cells sharing that edge in the plane
// perpendicular to the edge). Draw the edge when the count of occupied cells
// among those 4 is exactly 1 or 3 (a convex or concave silhouette edge).
// Counts of 0 (no geometry), 2 (flush interior/face-shared), and 4 (fully
// interior) produce no visible outer edge.

const OFFSETS = {
  // Edges along X: perpendicular plane is YZ; 4 surrounding cells vary in y,z.
  x: [
    [0, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
    [0, -1, -1],
  ],
  y: [
    [0, 0, 0],
    [-1, 0, 0],
    [0, 0, -1],
    [-1, 0, -1],
  ],
  z: [
    [0, 0, 0],
    [-1, 0, 0],
    [0, -1, 0],
    [-1, -1, 0],
  ],
} as const

/**
 * Build a BufferGeometry of line segments tracing the exposed outer edges of
 * the voxel set, with internal (face-shared) edges culled so adjacent cubes
 * read as one solid.
 */
export function buildEdgeGeometry(cells: Set<string>): THREE.BufferGeometry {
  const positions: number[] = []
  const occ = (x: number, y: number, z: number) => cells.has(keyOf(x, y, z))

  // Collect the bounding lattice range from occupied cells.
  const seen = new Set<string>()

  const addEdge = (
    axis: 'x' | 'y' | 'z',
    gx: number,
    gy: number,
    gz: number,
  ) => {
    // Dedup lattice edges by (axis, gridPoint).
    const ek = `${axis}:${gx},${gy},${gz}`
    if (seen.has(ek)) return
    seen.add(ek)

    let count = 0
    for (const [ox, oy, oz] of OFFSETS[axis]) {
      if (occ(gx + ox, gy + oy, gz + oz)) count++
    }
    if (count !== 1 && count !== 3) return

    // Emit the unit-length segment. World mapping matches Blocks/GridFloor:
    // grid X -> world Z, grid Y -> world X, grid Z -> world Y (up).
    // So world = (gy, gz, gx), and an edge along grid axis A steps that world component.
    positions.push(gy, gz, gx)
    if (axis === 'x') positions.push(gy, gz, gx + 1)
    else if (axis === 'y') positions.push(gy + 1, gz, gx)
    else positions.push(gy, gz + 1, gx)
  }

  // For every occupied cell, test the 12 lattice edges of its unit cube.
  for (const key of cells) {
    const [x, y, z] = key.split(',').map(Number)
    // 4 edges along X (vary y,z corners)
    addEdge('x', x, y, z)
    addEdge('x', x, y + 1, z)
    addEdge('x', x, y, z + 1)
    addEdge('x', x, y + 1, z + 1)
    // 4 edges along Y
    addEdge('y', x, y, z)
    addEdge('y', x + 1, y, z)
    addEdge('y', x, y, z + 1)
    addEdge('y', x + 1, y, z + 1)
    // 4 edges along Z
    addEdge('z', x, y, z)
    addEdge('z', x + 1, y, z)
    addEdge('z', x, y + 1, z)
    addEdge('z', x + 1, y + 1, z)
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geom
}
