import { useEffect } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { api } from '../api/client'
import { useEditorStore } from '../store/editorStore'
import { Scene } from '../three/Scene'
import { Toolbar } from '../ui/Toolbar'
import { ColorPanel } from '../ui/ColorPanel'
import { HelpOverlay } from '../ui/HelpOverlay'
import { useEditorHotkeys } from '../hooks/useEditorHotkeys'
import { useCameraControls } from '../hooks/useCameraControls'
import { rootRoute } from './root'

export const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/build/$id',
  // Fetch on entry AND on refresh, so the URL id is the source of truth.
  loader: ({ params }) => api.get(Number(params.id)),
  // A deleted/invalid id lands here instead of a blank canvas.
  errorComponent: BuildError,
  component: BuildScreen,
})

function BuildScreen() {
  const structure = buildRoute.useLoaderData()
  const loadStructure = useEditorStore((s) => s.loadStructure)

  useEditorHotkeys()
  useCameraControls()

  // Hydrate the editor store from the loaded structure whenever the id changes.
  useEffect(() => {
    loadStructure(structure)
  }, [structure, loadStructure])

  return (
    <div className="relative h-full w-full">
      <Scene />
      <Toolbar />
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center">
        <ColorPanel />
      </div>
      <HelpOverlay />
    </div>
  )
}

function BuildError() {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-white/70">That build couldn’t be loaded.</p>
      <button
        onClick={() => navigate({ to: '/' })}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
      >
        ← Back to builds
      </button>
    </div>
  )
}
