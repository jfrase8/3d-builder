import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditorStore } from '../store/editorStore'

const YAW_SPEED = 1.6 // rad/s
const PITCH_SPEED = 1.2
const ZOOM_STEP = 1.1

/**
 * Applies camera input each frame from the editor store (populated by
 * useCameraControls in the DOM tree). Spherical coords around the grid center
 * keep the orbit/pitch math simple.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const gridX = useEditorStore((s) => s.gridX)
  const gridY = useEditorStore((s) => s.gridY)

  const spherical = useRef(
    new THREE.Spherical(Math.max(gridX, gridY) * 1.4, Math.PI / 3.2, Math.PI / 4),
  )
  const target = useRef(new THREE.Vector3())

  useEffect(() => {
    // World X spans grid Y, world Z spans grid X (transposed mapping).
    target.current.set(gridY / 2, 0, gridX / 2)
  }, [gridX, gridY])

  useFrame((_, dt) => {
    const s = spherical.current
    const { camKeys, consumeZoom } = useEditorStore.getState()

    if (camKeys.left) s.theta -= YAW_SPEED * dt
    if (camKeys.right) s.theta += YAW_SPEED * dt
    if (camKeys.up) s.phi -= PITCH_SPEED * dt
    if (camKeys.down) s.phi += PITCH_SPEED * dt
    s.phi = THREE.MathUtils.clamp(s.phi, 0.08, Math.PI / 2 - 0.02)

    const zoom = consumeZoom()
    if (zoom !== 0) {
      s.radius = THREE.MathUtils.clamp(
        s.radius * (zoom > 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
        3,
        400,
      )
    }

    camera.position.setFromSpherical(s).add(target.current)
    camera.lookAt(target.current)
  })

  return null
}
