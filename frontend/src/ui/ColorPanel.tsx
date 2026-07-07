import { useState } from 'react'
import {
  Button,
  ColorArea,
  ColorField,
  ColorSlider,
  ColorSwatch,
  ColorThumb,
  Dialog,
  DialogTrigger,
  Input,
  Popover,
  SliderTrack,
  parseColor,
  type Color,
} from 'react-aria-components'
import { useEditorStore } from '../store/editorStore'

/**
 * Current-color picker with saved, persistent swatches. Choose a color from the
 * area/hue/hex controls to place blocks immediately, or save it as a swatch to
 * switch back later. Swatches can be recolored (click the pencil) or removed.
 */
export function ColorPanel() {
  const currentColor = useEditorStore((s) => s.currentColor)
  const setCurrentColor = useEditorStore((s) => s.setCurrentColor)
  const swatches = useEditorStore((s) => s.swatches)
  const addSwatch = useEditorStore((s) => s.addSwatch)
  const updateSwatch = useEditorStore((s) => s.updateSwatch)
  const removeSwatch = useEditorStore((s) => s.removeSwatch)
  const eyedrop = useEditorStore((s) => s.eyedrop)
  const setEyedrop = useEditorStore((s) => s.setEyedrop)

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-black/50 px-3 py-2 backdrop-blur">
      {/* Current color -> opens the picker */}
      <DialogTrigger>
        <Button
          className="rounded-md outline-none ring-white/40 focus-visible:ring-2"
          aria-label="Choose color"
        >
          <ColorSwatch
            color={currentColor}
            className="h-7 w-7 rounded-md border border-white/20"
          />
        </Button>
        <Popover className="rounded-xl border border-white/10 bg-neutral-900 p-3 shadow-xl">
          <Dialog className="outline-none">
            <ColorEditor
              value={currentColor}
              onChange={setCurrentColor}
              footer={
                <Button
                  onPress={() => addSwatch(currentColor)}
                  className="mt-1 w-full rounded-md bg-emerald-500/90 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Save as swatch
                </Button>
              }
            />
          </Dialog>
        </Popover>
      </DialogTrigger>

      {/* Eyedropper: click a block to pick its color */}
      <Button
        onPress={() => setEyedrop(!eyedrop)}
        aria-label="Pick color from a block"
        className={`rounded-md px-2 py-1 text-sm ${
          eyedrop ? 'bg-amber-400 text-black' : 'text-white/70 hover:bg-white/10'
        }`}
      >
        ⛏
      </Button>

      {/* Saved swatches */}
      <div className="flex items-center gap-1">
        {swatches.map((hex, i) => (
          <SwatchButton
            key={`${hex}-${i}`}
            hex={hex}
            active={hex.toLowerCase() === currentColor.toLowerCase()}
            onSelect={() => setCurrentColor(hex)}
            onEdit={(next) => updateSwatch(i, next)}
            onRemove={() => removeSwatch(i)}
          />
        ))}
        {swatches.length === 0 && (
          <span className="px-1 text-xs text-white/30">no swatches</span>
        )}
      </div>
    </div>
  )
}

/** A saved swatch: click to select; hosts an edit popover and a remove button. */
function SwatchButton({
  hex,
  active,
  onSelect,
  onEdit,
  onRemove,
}: {
  hex: string
  active: boolean
  onSelect: () => void
  onEdit: (hex: string) => void
  onRemove: () => void
}) {
  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        aria-label={`Use swatch ${hex}`}
        className={`block h-7 w-7 rounded-md border ${
          active ? 'border-white ring-2 ring-white/60' : 'border-white/20'
        }`}
        style={{ backgroundColor: hex }}
      />
      {/* Remove (top-right, on hover) */}
      <button
        onClick={onRemove}
        aria-label="Remove swatch"
        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white group-hover:flex"
      >
        ×
      </button>
      {/* Edit (bottom-right, on hover) via a popover editor */}
      <DialogTrigger>
        <Button
          aria-label="Edit swatch color"
          className="absolute -bottom-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[9px] leading-none text-white group-hover:flex"
        >
          ✎
        </Button>
        <Popover className="rounded-xl border border-white/10 bg-neutral-900 p-3 shadow-xl">
          <Dialog className="outline-none">
            <ColorEditor value={hex} onChange={onEdit} />
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  )
}

/**
 * The React Aria color editor: 2D area (saturation/brightness), a hue slider,
 * and a hex field. Emits hex strings. Kept internally controlled so dragging is
 * smooth, and pushes changes up via onChange.
 */
function ColorEditor({
  value,
  onChange,
  footer,
}: {
  value: string
  onChange: (hex: string) => void
  footer?: React.ReactNode
}) {
  const [color, setColor] = useState<Color>(() => parseColor(value).toFormat('hsb'))

  const update = (c: Color) => {
    setColor(c)
    onChange(c.toString('hex'))
  }

  return (
    <div className="flex w-56 flex-col gap-3">
      <ColorArea
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
        value={color}
        onChange={update}
        className="h-40 w-full rounded-lg"
      >
        <ColorThumb className="h-4 w-4 rounded-full border-2 border-white shadow" />
      </ColorArea>

      <ColorSlider colorSpace="hsb" channel="hue" value={color} onChange={update}>
        <SliderTrack className="h-4 rounded-full">
          <ColorThumb className="top-1/2 h-4 w-4 rounded-full border-2 border-white shadow" />
        </SliderTrack>
      </ColorSlider>

      <ColorField
        value={color}
        onChange={(c) => c && update(c)}
        className="flex flex-col gap-1"
        aria-label="Hex color"
      >
        <Input className="rounded bg-white/10 px-2 py-1 text-sm outline-none focus:bg-white/20" />
      </ColorField>

      {footer}
    </div>
  )
}
