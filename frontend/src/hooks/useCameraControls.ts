import { useEffect } from 'react'
import { useKeyHold } from '@tanstack/react-hotkeys'
import { useEditorStore } from '../store/editorStore'

/**
 * Camera input, bound via TanStack Hotkeys' useKeyHold for smooth held-key
 * motion:
 *   Left/Right : yaw (orbit)
 *   Up/Down    : pitch (top-down <-> side-on)
 *   Wheel      : zoom
 * Held state and wheel delta are pushed into the editor store; CameraRig
 * applies them in its frame loop (inside the R3F Canvas).
 */
export function useCameraControls() {
  const left = useKeyHold('ArrowLeft')
  const right = useKeyHold('ArrowRight')
  const up = useKeyHold('ArrowUp')
  const down = useKeyHold('ArrowDown')

  const setCamKeys = useEditorStore((s) => s.setCamKeys)
  const addZoom = useEditorStore((s) => s.addZoom)

  useEffect(() => {
    setCamKeys({ left, right, up, down })
  }, [left, right, up, down, setCamKeys])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      addZoom(Math.sign(e.deltaY))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [addZoom])
}
