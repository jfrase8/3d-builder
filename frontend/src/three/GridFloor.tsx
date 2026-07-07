import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'
import { useEditorStore } from '../store/editorStore'

/**
 * Build grid lattice lines for a gridX-by-gridY grid on the world XZ plane,
 * anchored with cell (0,0) at the world origin. Axis mapping (viewed top-down,
 * origin at bottom-left): grid X -> world Z (screen width/right), grid Y ->
 * world X (screen depth/up). Lines run 0..gridX and 0..gridY so the grid only
 * ever extends away from the origin corner.
 */
function useGridLines(gridX: number, gridY: number) {
  return useMemo(() => {
    const pts: number[] = []
    // grid X spans world Z; grid Y spans world X.
    for (let x = 0; x <= gridX; x++) pts.push(0, 0, x, gridY, 0, x)
    for (let y = 0; y <= gridY; y++) pts.push(y, 0, 0, y, 0, gridX)
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geom
  }, [gridX, gridY])
}

/**
 * The build surface: a grid of size gridX * gridY lying on the world XZ plane
 * (world Y = 0). Clicking a cell moves the cursor there; the invisible plane
 * gives us pointer picking without per-cell meshes.
 */
export function GridFloor() {
  const gridX = useEditorStore((s) => s.gridX)
  const gridY = useEditorStore((s) => s.gridY)
  const setCursor = useEditorStore((s) => s.setCursor)
  const beginDrag = useEditorStore((s) => s.beginDrag)
  const dragTo = useEditorStore((s) => s.dragTo)
  const endDrag = useEditorStore((s) => s.endDrag)
  const dragging = useEditorStore((s) => s.dragging)
  const eyedrop = useEditorStore((s) => s.eyedrop)
  const lines = useGridLines(gridX, gridY)

  // grid X <- world Z, grid Y <- world X (see useGridLines mapping).
  const cellOf = (e: ThreeEvent<PointerEvent>): [number, number] => [
    Math.floor(e.point.z),
    Math.floor(e.point.x),
  ]

  // Pointer down starts a drag-paint (a plain click without motion paints one
  // cell). Moving while dragging paints the swept cells at the locked Z; moving
  // otherwise just previews the cursor. In eyedrop mode the floor is inert so
  // clicks fall through to Blocks (which handles color picking).
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (eyedrop) return
    e.stopPropagation()
    const [x, y] = cellOf(e)
    beginDrag(x, y)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (eyedrop) return
    e.stopPropagation()
    const [x, y] = cellOf(e)
    if (dragging) dragTo(x, y)
    else setCursor(x, y)
  }

  // End the drag on release anywhere (the pointer may leave the grid mid-drag).
  useEffect(() => {
    const up = () => endDrag()
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [endDrag])

  return (
    <group>
      {/* Lattice lines, anchored at the origin corner (0,0). */}
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#33405c" />
      </lineSegments>
      {/* Pointer-pick plane, sized to the grid, laid flat on XZ.
          World X spans grid Y, world Z spans grid X (transposed mapping). */}
      <mesh
        position={[gridY / 2, 0, gridX / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <planeGeometry args={[gridY, gridX]} />
        <meshBasicMaterial color="#10151f" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Origin marker at cell (0,0): the anchor the grid expands away from.
          Nudged just above the floor plane to avoid z-fighting. */}
      <mesh position={[0.5, 0.002, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f5a623" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
