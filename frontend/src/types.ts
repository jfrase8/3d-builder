export interface Block {
  x: number
  y: number
  z: number
  /** Hex color, e.g. "#5b8def". Absent on legacy blocks -> DEFAULT_COLOR. */
  color?: string
}

/** Fallback color for blocks saved before per-block color existed. */
export const DEFAULT_COLOR = '#5b8def'

export interface Structure {
  id: number
  name: string
  gridX: number
  gridY: number
  blocks: Block[]
  createdAt: string
  updatedAt: string
}

/** Payload sent to the backend on create/update. */
export interface StructureInput {
  name: string
  gridX: number
  gridY: number
  blocks: Block[]
}

export type EditorMode = 'place' | 'delete'

/** Stable string key for a block coordinate, used as a Set/Map key. */
export const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`
