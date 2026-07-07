import { useEditorStore } from '../store/editorStore'

export function HelpOverlay() {
  const cursor = useEditorStore((s) => s.cursor)
  const ghostZ = useEditorStore((s) => s.ghostZ())

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-xl bg-black/50 px-4 py-3 text-xs leading-relaxed text-white/80 backdrop-blur">
      <div className="mb-1 font-semibold text-white/90">Controls</div>
      <div>WASD — move cursor</div>
      <div>Space / Enter / Click — {`{place | delete}`}</div>
      <div>Q / M — toggle mode</div>
      <div>← → — orbit · ↑ ↓ — pitch · wheel — zoom</div>
      <div className="mt-2 text-white/50">
        cursor ({cursor.x}, {cursor.y}) · z {ghostZ}
      </div>
    </div>
  )
}
