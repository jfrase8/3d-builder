import { Button, ToggleButton } from 'react-aria-components'
import { useNavigate } from '@tanstack/react-router'
import { useEditorStore } from '../store/editorStore'
import { usePersistence } from '../hooks/usePersistence'

export function Toolbar() {
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const name = useEditorStore((s) => s.name)
  const setName = useEditorStore((s) => s.setName)
  const gridX = useEditorStore((s) => s.gridX)
  const gridY = useEditorStore((s) => s.gridY)
  const setGrid = useEditorStore((s) => s.setGrid)
  const dirty = useEditorStore((s) => s.dirty)
  // Grid can't shrink below the extent of placed blocks; reflect that as the
  // input min and a hint so the clamp isn't surprising. Select primitives (not
  // a fresh object) so the snapshot is stable and doesn't loop.
  const min = { x: useEditorStore((s) => s.minGrid().x), y: useEditorStore((s) => s.minGrid().y) }

  const { save, isSaving, error } = usePersistence()
  const navigate = useNavigate()

  // Save any pending changes before leaving so nothing is lost on the way out.
  const goHome = () => {
    if (useEditorStore.getState().dirty) save()
    navigate({ to: '/' })
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4">
      {/* Left: back + name + grid size */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-black/50 px-4 py-2 backdrop-blur">
        <Button
          onPress={goHome}
          className="rounded px-2 py-1 text-sm text-white/70 hover:bg-white/10"
          aria-label="Back to builds"
        >
          ←
        </Button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-40 rounded bg-white/10 px-2 py-1 text-sm outline-none focus:bg-white/20"
          aria-label="Structure name"
        />
        <label className="flex items-center gap-1 text-xs text-white/70">
          X
          <input
            type="number"
            min={min.x}
            max={128}
            value={gridX}
            onChange={(e) => setGrid(Number(e.target.value) || 1, gridY)}
            title={`Minimum ${min.x} — blocks are placed up to that column`}
            className="w-14 rounded bg-white/10 px-1 py-1 text-sm outline-none"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-white/70">
          Y
          <input
            type="number"
            min={min.y}
            max={128}
            value={gridY}
            onChange={(e) => setGrid(gridX, Number(e.target.value) || 1)}
            title={`Minimum ${min.y} — blocks are placed up to that row`}
            className="w-14 rounded bg-white/10 px-1 py-1 text-sm outline-none"
          />
        </label>
      </div>

      {/* Right: mode toggle + save */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-black/50 px-3 py-2 backdrop-blur">
        <div className="flex overflow-hidden rounded-lg border border-white/10">
          <ToggleButton
            isSelected={mode === 'place'}
            onChange={() => setMode('place')}
            className={`px-3 py-1 text-sm ${mode === 'place' ? 'bg-blue-500 text-white' : 'text-white/70'}`}
          >
            Place
          </ToggleButton>
          <ToggleButton
            isSelected={mode === 'delete'}
            onChange={() => setMode('delete')}
            className={`px-3 py-1 text-sm ${mode === 'delete' ? 'bg-red-500 text-white' : 'text-white/70'}`}
          >
            Delete
          </ToggleButton>
        </div>

        <Button
          onPress={save}
          isDisabled={isSaving}
          className="rounded-lg bg-emerald-500 px-4 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : dirty ? 'Save*' : 'Save'}
        </Button>
      </div>

      {error && (
        <div className="pointer-events-auto absolute right-4 top-16 rounded bg-red-600/90 px-3 py-1 text-xs">
          {error.message}
        </div>
      )}
    </div>
  )
}
