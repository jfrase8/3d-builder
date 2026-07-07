import { useEditorStore } from '../store/editorStore'

/**
 * Place mode: a semi-transparent ghost cube at the resting position.
 * Delete mode: a wireframe highlight around the block that would be removed.
 */
export function Ghost() {
  const mode = useEditorStore((s) => s.mode)
  const cursor = useEditorStore((s) => s.cursor)
  const ghostZ = useEditorStore((s) => s.ghostZ())
  const deleteTargetZ = useEditorStore((s) => s.deleteTargetZ())
  const currentColor = useEditorStore((s) => s.currentColor)
  const eyedrop = useEditorStore((s) => s.eyedrop)

  // No placement/delete preview while picking a color.
  if (eyedrop) return null

  // Axis mapping: grid X -> world Z, grid Y -> world X (matches Blocks/GridFloor).
  if (mode === 'place') {
    return (
      <mesh position={[cursor.y + 0.5, ghostZ + 0.5, cursor.x + 0.5]}>
        <boxGeometry args={[1, 1, 1]} />
        {/* Preview in the current paint color so you see what you'll place. */}
        <meshStandardMaterial color={currentColor} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    )
  }

  if (deleteTargetZ === null) return null
  return (
    <mesh position={[cursor.y + 0.5, deleteTargetZ + 0.5, cursor.x + 0.5]}>
      <boxGeometry args={[1.04, 1.04, 1.04]} />
      <meshBasicMaterial color="#ff5a5a" wireframe />
    </mesh>
  )
}
