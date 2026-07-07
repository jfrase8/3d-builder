import { create } from 'zustand'
import type { Block, EditorMode, Structure } from '../types'
import { DEFAULT_COLOR, keyOf } from '../types'

// Saved swatches persist across refreshes via localStorage.
const SWATCHES_KEY = 'builder.swatches'
const CURRENT_COLOR_KEY = 'builder.currentColor'

function loadSwatches(): string[] {
  try {
    const raw = localStorage.getItem(SWATCHES_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}

function persistSwatches(swatches: string[]) {
  localStorage.setItem(SWATCHES_KEY, JSON.stringify(swatches))
}

interface EditorState {
  // --- persisted structure fields ---
  id: number | null
  name: string
  gridX: number
  gridY: number

  // Occupied cells, keyed by "x,y,z". Set membership is the source of truth.
  cells: Set<string>
  // Per-cell color, keyed by "x,y,z" (same keys as cells). Missing -> DEFAULT_COLOR.
  colors: Map<string, string>
  // Per-column (x,y) count of stacked blocks == the height at that column.
  // Because stacking is unrestricted-but-contiguous from z=0, count === next free z.
  heights: Map<string, number>

  // --- editor UI state ---
  mode: EditorMode
  cursor: { x: number; y: number }
  dirty: boolean

  // --- color state ---
  currentColor: string // hex; color new blocks are placed with
  swatches: string[] // saved colors, persisted to localStorage
  eyedrop: boolean // when true, clicking a block picks its color into currentColor

  // Click-drag paint state. While dragging, place/delete are locked to dragZ
  // (the resting/target Z at the cell where the drag began) so the sweep paints
  // one flat layer instead of following each column's height.
  dragging: boolean
  dragZ: number

  // Held state of the camera arrow keys, fed by useCameraControls (DOM tree)
  // and consumed by CameraRig's frame loop (inside the R3F Canvas). Kept in the
  // store so we don't need to bridge React context across the Canvas boundary.
  camKeys: { left: boolean; right: boolean; up: boolean; down: boolean }
  zoomDelta: number

  // --- selectors ---
  ghostZ: () => number
  deleteTargetZ: () => number | null
  // Smallest [gridX, gridY] that still contains every placed block. The grid
  // cannot be shrunk below this without orphaning blocks.
  minGrid: () => { x: number; y: number }

  // --- actions ---
  setGrid: (gridX: number, gridY: number) => void
  setName: (name: string) => void
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
  moveCursor: (dx: number, dy: number) => void
  setCursor: (x: number, y: number) => void
  commit: () => void
  // Drag-paint lifecycle. beginDrag locks the Z level and paints the first
  // cell; dragTo paints subsequent swept cells at that locked Z; endDrag clears.
  beginDrag: (x: number, y: number) => void
  dragTo: (x: number, y: number) => void
  endDrag: () => void
  loadStructure: (s: Structure) => void
  reset: () => void
  markSaved: (id: number) => void
  toBlocks: () => Block[]

  setCamKeys: (keys: Partial<EditorState['camKeys']>) => void
  addZoom: (delta: number) => void
  consumeZoom: () => number

  // --- color actions ---
  setCurrentColor: (hex: string) => void
  addSwatch: (hex: string) => void
  updateSwatch: (index: number, hex: string) => void
  removeSwatch: (index: number) => void
  setEyedrop: (on: boolean) => void
  // Pick the color of the top block at (x,y) into currentColor; exits eyedrop.
  pickColorAt: (x: number, y: number) => void
}

const colKey = (x: number, y: number) => `${x},${y}`

function indexBlocks(blocks: Block[]) {
  const cells = new Set<string>()
  const colors = new Map<string, string>()
  const heights = new Map<string, number>()
  for (const b of blocks) {
    const k = keyOf(b.x, b.y, b.z)
    cells.add(k)
    colors.set(k, b.color ?? DEFAULT_COLOR)
    const ck = colKey(b.x, b.y)
    heights.set(ck, Math.max(heights.get(ck) ?? 0, b.z + 1))
  }
  return { cells, colors, heights }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export const useEditorStore = create<EditorState>((set, get) => ({
  id: null,
  name: 'Untitled',
  gridX: 16,
  gridY: 16,
  cells: new Set(),
  colors: new Map(),
  heights: new Map(),
  mode: 'place',
  cursor: { x: 0, y: 0 },
  dirty: false,
  currentColor: localStorage.getItem(CURRENT_COLOR_KEY) ?? DEFAULT_COLOR,
  swatches: loadSwatches(),
  eyedrop: false,
  dragging: false,
  dragZ: 0,
  camKeys: { left: false, right: false, up: false, down: false },
  zoomDelta: 0,

  // Highest resting z at the current column === current column height. While a
  // place-drag is active, the ghost stays on the locked drag layer instead.
  ghostZ: () => {
    const { cursor, heights, dragging, dragZ } = get()
    if (dragging) return dragZ
    return heights.get(colKey(cursor.x, cursor.y)) ?? 0
  },

  // Topmost existing block z at the cursor column, or null if empty.
  deleteTargetZ: () => {
    const { cursor, heights } = get()
    const h = heights.get(colKey(cursor.x, cursor.y)) ?? 0
    return h > 0 ? h - 1 : null
  },

  minGrid: () => {
    let x = 1
    let y = 1
    // heights keys are exactly the occupied "x,y" columns.
    for (const ck of get().heights.keys()) {
      const [cx, cy] = ck.split(',').map(Number)
      if (cx + 1 > x) x = cx + 1
      if (cy + 1 > y) y = cy + 1
    }
    return { x, y }
  },

  // Clamp so a shrink can never orphan placed blocks; the UI mirrors this by
  // setting the inputs' min to minGrid().
  setGrid: (gridX, gridY) =>
    set((s) => {
      const min = s.minGrid()
      const nx = Math.max(gridX, min.x)
      const ny = Math.max(gridY, min.y)
      return {
        gridX: nx,
        gridY: ny,
        cursor: { x: clamp(s.cursor.x, 0, nx - 1), y: clamp(s.cursor.y, 0, ny - 1) },
        dirty: true,
      }
    }),

  setName: (name) => set({ name, dirty: true }),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === 'place' ? 'delete' : 'place' })),

  moveCursor: (dx, dy) =>
    set((s) => ({
      cursor: {
        x: clamp(s.cursor.x + dx, 0, s.gridX - 1),
        y: clamp(s.cursor.y + dy, 0, s.gridY - 1),
      },
    })),

  setCursor: (x, y) =>
    set((s) => ({
      cursor: { x: clamp(x, 0, s.gridX - 1), y: clamp(y, 0, s.gridY - 1) },
    })),

  commit: () => {
    const { mode, cursor, cells, colors, heights, currentColor } = get()
    const ck = colKey(cursor.x, cursor.y)
    const h = heights.get(ck) ?? 0

    // Clone the mutable indexes so subscribers see a new reference.
    const nextCells = new Set(cells)
    const nextColors = new Map(colors)
    const nextHeights = new Map(heights)

    if (mode === 'place') {
      const k = keyOf(cursor.x, cursor.y, h)
      nextCells.add(k)
      nextColors.set(k, currentColor)
      nextHeights.set(ck, h + 1)
    } else {
      if (h === 0) return // nothing to delete
      const k = keyOf(cursor.x, cursor.y, h - 1)
      nextCells.delete(k)
      nextColors.delete(k)
      if (h - 1 === 0) nextHeights.delete(ck)
      else nextHeights.set(ck, h - 1)
    }
    set({ cells: nextCells, colors: nextColors, heights: nextHeights, dirty: true })
  },

  beginDrag: (x, y) => {
    const { mode, heights } = get()
    const h = heights.get(colKey(x, y)) ?? 0
    // Place: lock to the resting layer (== column height). Delete: lock to the
    // top block's layer (height - 1). An empty column in delete mode has no
    // target; use -1 so dragTo's guards no-op everywhere.
    const dragZ = mode === 'place' ? h : h - 1
    set({ dragging: true, dragZ, cursor: { x, y } })
    get().dragTo(x, y) // paint the starting cell
  },

  dragTo: (x, y) => {
    const { dragging, dragZ, mode, cells, colors, heights, currentColor } = get()
    if (!dragging || dragZ < 0) return
    const ck = colKey(x, y)
    const h = heights.get(ck) ?? 0

    if (mode === 'place') {
      // Only fill a column whose resting height is exactly the locked layer:
      // taller columns already occupy it; shorter ones would float (gap).
      if (h !== dragZ) return
      const k = keyOf(x, y, dragZ)
      const nextCells = new Set(cells)
      const nextColors = new Map(colors)
      const nextHeights = new Map(heights)
      nextCells.add(k)
      nextColors.set(k, currentColor)
      nextHeights.set(ck, dragZ + 1)
      set({ cursor: { x, y }, cells: nextCells, colors: nextColors, heights: nextHeights, dirty: true })
    } else {
      // Only erase a column whose top block sits on the locked layer, keeping
      // stacks contiguous (no mid-stack holes).
      if (h !== dragZ + 1) return
      const k = keyOf(x, y, dragZ)
      const nextCells = new Set(cells)
      const nextColors = new Map(colors)
      const nextHeights = new Map(heights)
      nextCells.delete(k)
      nextColors.delete(k)
      if (dragZ === 0) nextHeights.delete(ck)
      else nextHeights.set(ck, dragZ)
      set({ cursor: { x, y }, cells: nextCells, colors: nextColors, heights: nextHeights, dirty: true })
    }
  },

  endDrag: () => set({ dragging: false }),

  loadStructure: (s) => {
    const { cells, colors, heights } = indexBlocks(s.blocks)
    set({
      id: s.id,
      name: s.name,
      gridX: s.gridX,
      gridY: s.gridY,
      cells,
      colors,
      heights,
      cursor: { x: 0, y: 0 },
      dirty: false,
      eyedrop: false,
    })
  },

  reset: () =>
    set({
      id: null,
      name: 'Untitled',
      gridX: 16,
      gridY: 16,
      cells: new Set(),
      colors: new Map(),
      heights: new Map(),
      cursor: { x: 0, y: 0 },
      mode: 'place',
      dirty: false,
      eyedrop: false,
    }),

  markSaved: (id) => set({ id, dirty: false }),

  toBlocks: () => {
    const { cells, colors } = get()
    const out: Block[] = []
    for (const key of cells) {
      const [x, y, z] = key.split(',').map(Number)
      out.push({ x, y, z, color: colors.get(key) ?? DEFAULT_COLOR })
    }
    return out
  },

  setCamKeys: (keys) => set((s) => ({ camKeys: { ...s.camKeys, ...keys } })),
  addZoom: (delta) => set((s) => ({ zoomDelta: s.zoomDelta + delta })),
  // Read-and-clear the accumulated wheel delta (called once per frame).
  consumeZoom: () => {
    const d = get().zoomDelta
    if (d !== 0) set({ zoomDelta: 0 })
    return d
  },

  setCurrentColor: (hex) => {
    localStorage.setItem(CURRENT_COLOR_KEY, hex)
    set({ currentColor: hex })
  },

  addSwatch: (hex) =>
    set((s) => {
      if (s.swatches.includes(hex)) return s // no duplicates
      const swatches = [...s.swatches, hex]
      persistSwatches(swatches)
      return { swatches }
    }),

  updateSwatch: (index, hex) =>
    set((s) => {
      const swatches = s.swatches.map((c, i) => (i === index ? hex : c))
      persistSwatches(swatches)
      return { swatches }
    }),

  removeSwatch: (index) =>
    set((s) => {
      const swatches = s.swatches.filter((_, i) => i !== index)
      persistSwatches(swatches)
      return { swatches }
    }),

  setEyedrop: (on) => set({ eyedrop: on }),

  pickColorAt: (x, y) => {
    const { heights, colors } = get()
    const h = heights.get(colKey(x, y)) ?? 0
    if (h === 0) return // empty column, nothing to pick
    const hex = colors.get(keyOf(x, y, h - 1)) ?? DEFAULT_COLOR
    localStorage.setItem(CURRENT_COLOR_KEY, hex)
    set({ currentColor: hex, eyedrop: false })
  },
}))
