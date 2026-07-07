import { useHotkey } from '@tanstack/react-hotkeys'
import { useEditorStore } from '../store/editorStore'

/**
 * Editor hotkeys, bound via TanStack Hotkeys:
 *   W/A/S/D          : move ghost cursor on the grid (Y/X)
 *   Space / Enter    : commit (place or delete per active mode)
 *   Q or M           : toggle place/delete mode
 * Arrow keys are reserved for the camera (see useCameraControls).
 *
 * HotkeysProvider ignores events originating from form fields by default, so
 * typing in the name input won't trigger these.
 */
export function useEditorHotkeys() {
  const moveCursor = useEditorStore((s) => s.moveCursor)
  const commit = useEditorStore((s) => s.commit)
  const toggleMode = useEditorStore((s) => s.toggleMode)

  useHotkey('W', () => moveCursor(0, -1))
  useHotkey('S', () => moveCursor(0, 1))
  useHotkey('A', () => moveCursor(-1, 0))
  useHotkey('D', () => moveCursor(1, 0))

  useHotkey('Space', () => commit(), { requireReset: true })
  useHotkey('Enter', () => commit(), { requireReset: true })

  useHotkey('Q', () => toggleMode(), { requireReset: true })
  useHotkey('M', () => toggleMode(), { requireReset: true })
}
