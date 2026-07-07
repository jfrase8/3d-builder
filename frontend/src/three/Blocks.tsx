import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'
import { useEditorStore } from '../store/editorStore'
import { DEFAULT_COLOR } from '../types'
import { buildEdgeGeometry } from './edges'

const tmp = new THREE.Object3D()
const tmpColor = new THREE.Color()

/**
 * Renders all placed blocks as a single InstancedMesh (one draw call) with a
 * per-instance color, plus a LineSegments overlay tracing only the exposed
 * outer edges of the merged solid. Internal shared faces are never drawn
 * because adjacent instances' box faces are coplanar and coincident; internal
 * edges are culled in buildEdgeGeometry, so the structure reads as unified.
 */
export function Blocks() {
  const cells = useEditorStore((s) => s.cells)
  const colors = useEditorStore((s) => s.colors)
  const eyedrop = useEditorStore((s) => s.eyedrop)
  const pickColorAt = useEditorStore((s) => s.pickColorAt)
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  // Keep the cell key with the coord so we can look up its color.
  const coords = useMemo(
    () =>
      [...cells].map((k) => {
        const [x, y, z] = k.split(',').map(Number)
        return { k, x, y, z }
      }),
    [cells],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    coords.forEach(({ k, x, y, z }, i) => {
      // Axis mapping: grid X -> world Z, grid Y -> world X, grid stack z ->
      // world Y (up). Center the unit cube on the lattice cell.
      tmp.position.set(y + 0.5, z + 0.5, x + 0.5)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
      mesh.setColorAt(i, tmpColor.set(colors.get(k) ?? DEFAULT_COLOR))
    })
    mesh.count = coords.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [coords, colors])

  const edgeGeom = useMemo(() => buildEdgeGeometry(cells), [cells])

  // In eyedrop mode, pressing on a block picks its color. Use pointerdown (not
  // click) so it fires before the floor's drag handlers and doesn't depend on a
  // clean down+up landing on the same instance.
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!eyedrop || e.instanceId == null) return
    e.stopPropagation()
    const { x, y } = coords[e.instanceId]
    pickColorAt(x, y)
  }

  return (
    <group>
      {/* key forces a fresh InstancedMesh when the max count grows. */}
      <instancedMesh
        key={coords.length}
        ref={meshRef}
        args={[undefined, undefined, Math.max(coords.length, 1)]}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.55} metalness={0.05} />
      </instancedMesh>

      <lineSegments geometry={edgeGeom}>
        <lineBasicMaterial color="#0b0e14" />
      </lineSegments>
    </group>
  )
}
