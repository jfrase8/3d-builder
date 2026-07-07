import { useEffect, useRef, useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { api } from '../api/client'
import type { Structure } from '../types'
import { namesExcept, uniqueName } from '../lib/names'
import { rootRoute } from './root'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StartScreen,
})

function StartScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: builds = [], isLoading } = useQuery({
    queryKey: ['structures'],
    queryFn: api.list,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['structures'] })

  const create = useMutation({
    mutationFn: () => {
      const taken = new Set(builds.map((b) => b.name.trim().toLowerCase()))
      return api.create({ name: uniqueName('Untitled', taken), gridX: 16, gridY: 16, blocks: [] })
    },
    onSuccess: (s) => {
      invalidate()
      navigate({ to: '/build/$id', params: { id: String(s.id) } })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: ({ s, name }: { s: Structure; name: string }) => {
      const finalName = uniqueName(name.trim(), namesExcept(builds, s.id))
      return api.update(s.id, { name: finalName, gridX: s.gridX, gridY: s.gridY, blocks: s.blocks })
    },
    onSuccess: (saved) => {
      invalidate()
      toast.success(`Renamed to “${saved.name}”`)
    },
  })

  const duplicate = useMutation({
    mutationFn: async (s: Structure) => {
      const full = await api.get(s.id)
      const taken = new Set(builds.map((b) => b.name.trim().toLowerCase()))
      return api.create({
        name: uniqueName(full.name, taken),
        gridX: full.gridX,
        gridY: full.gridY,
        blocks: full.blocks,
      })
    },
    onSuccess: (s) => {
      invalidate()
      toast.success(`Created “${s.name}”`)
    },
  })

  // Confirm delete with a Sonner toast rather than window.confirm.
  const confirmDelete = (s: Structure) =>
    toast(`Delete “${s.name}”?`, {
      description: 'This cannot be undone.',
      duration: Infinity,
      action: {
        label: 'Delete',
        onClick: () =>
          remove.mutate(s.id, {
            onSuccess: () => toast.success(`Deleted “${s.name}”`),
            onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
          }),
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    })

  // id of the card whose name input is currently editable.
  const [editingId, setEditingId] = useState<number | null>(null)

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Builds</h1>
        <Button
          onPress={() => create.mutate()}
          isDisabled={create.isPending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : '+ New Build'}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-white/50">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="text-white/50">No builds yet. Create your first one.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {builds.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 hover:bg-white/10"
            >
              <div className="min-w-0 flex-1">
                <NameField
                  structure={s}
                  editing={editingId === s.id}
                  onCommit={(name) => {
                    setEditingId(null)
                    if (name.trim() && name.trim() !== s.name) rename.mutate({ s, name })
                  }}
                  onCancel={() => setEditingId(null)}
                  onOpen={() => navigate({ to: '/build/$id', params: { id: String(s.id) } })}
                />
                <div className="text-xs text-white/40">
                  {s.gridX}×{s.gridY} · updated {new Date(s.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs">
                <Button
                  onPress={() => setEditingId(s.id)}
                  className="rounded px-2 py-1 text-white/70 hover:bg-white/10"
                >
                  Rename
                </Button>
                <Button
                  onPress={() => duplicate.mutate(s)}
                  className="rounded px-2 py-1 text-white/70 hover:bg-white/10"
                >
                  Duplicate
                </Button>
                <Button
                  onPress={() => confirmDelete(s)}
                  className="rounded px-2 py-1 text-red-400 hover:bg-red-500/20"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The build name on the card. When `editing`, renders a focused input that
 * commits on blur or Enter and cancels on Escape; otherwise a button that
 * opens the build.
 */
function NameField({
  structure,
  editing,
  onCommit,
  onCancel,
  onOpen,
}: {
  structure: Structure
  editing: boolean
  onCommit: (name: string) => void
  onCancel: () => void
  onOpen: () => void
}) {
  const [value, setValue] = useState(structure.name)
  const inputRef = useRef<HTMLInputElement>(null)
  // Set on Escape so the ensuing blur cancels instead of committing.
  const cancelledRef = useRef(false)

  // Reset the draft and focus/select when entering edit mode.
  useEffect(() => {
    if (editing) {
      setValue(structure.name)
      cancelledRef.current = false
      // Focus after the input has rendered.
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, structure.name])

  if (!editing) {
    return (
      <button onClick={onOpen} className="block truncate text-left font-medium">
        {structure.name}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => (cancelledRef.current ? onCancel() : onCommit(value))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur() // triggers onBlur -> commit
        else if (e.key === 'Escape') {
          cancelledRef.current = true
          e.currentTarget.blur() // triggers onBlur -> cancel
        }
      }}
      className="w-full rounded bg-white/10 px-2 py-1 font-medium outline-none focus:bg-white/20"
      aria-label="Build name"
    />
  )
}
