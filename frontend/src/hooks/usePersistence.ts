import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useHotkey } from '@tanstack/react-hotkeys'
import { api, ApiError } from '../api/client'
import { useEditorStore } from '../store/editorStore'
import { namesExcept, uniqueName } from '../lib/names'
import type { StructureInput } from '../types'

const AUTOSAVE_MS = 2 * 60 * 1000

/**
 * Save orchestration for the builder view. The structure id is owned by the URL
 * (/build/$id) and loaded into the store before this mounts, so a save is
 * always a PUT to that id. Manual save is Mod+S; a 2-minute interval auto-saves
 * whenever there are unsaved changes.
 */
export function usePersistence() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (): Promise<{ id: number; name: string }> => {
      const s = useEditorStore.getState()
      if (s.id === null) throw new Error('no active structure id')
      const id = s.id
      // Enforce name uniqueness against other builds here too (the editor name
      // input is a separate save path from the start-screen rename). Resolve to
      // a free "name (n)" so two builds can't collide.
      const base: Omit<StructureInput, 'name'> = {
        gridX: s.gridX,
        gridY: s.gridY,
        blocks: s.toBlocks(),
      }
      const resolveName = async () =>
        uniqueName(s.name.trim() || 'Untitled', namesExcept(await api.list(), id))

      // The DB enforces name uniqueness as a race backstop. Normally our
      // pre-resolved name already avoids collisions; if another client claimed
      // it between list and save, re-resolve once against the fresh list.
      try {
        const saved = await api.update(id, { ...base, name: await resolveName() })
        return { id: saved.id, name: saved.name }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const saved = await api.update(id, { ...base, name: await resolveName() })
          return { id: saved.id, name: saved.name }
        }
        throw err
      }
    },
    onSuccess: ({ id, name }) => {
      const store = useEditorStore.getState()
      // Reflect the resolved (possibly de-duplicated) name back in the editor.
      if (name !== store.name) store.setName(name)
      store.markSaved(id)
      queryClient.invalidateQueries({ queryKey: ['structures'] })
    },
  })

  // Stable save callback; guards against overlapping saves.
  const save = useCallback(() => {
    if (mutation.isPending) return
    mutation.mutate()
  }, [mutation])

  const saveRef = useRef(save)
  saveRef.current = save

  // Mod+S (Ctrl/Cmd+S) triggers a manual save instead of the browser dialog.
  useHotkey('Mod+S', () => saveRef.current(), { requireReset: true })

  useEffect(() => {
    const id = setInterval(() => {
      if (useEditorStore.getState().dirty) saveRef.current()
    }, AUTOSAVE_MS)
    return () => clearInterval(id)
  }, [])

  return { save, isSaving: mutation.isPending, error: mutation.error as Error | null }
}
