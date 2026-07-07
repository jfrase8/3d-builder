# 3D Builder

A voxel-style 3D block editor. React 19 + React Three Fiber front end, Go + SQLite REST backend.

## Structure

```
backend/                 Go REST API (chi) + SQLite (modernc, pure-Go, no CGO)
  cmd/server/main.go     entrypoint, router, CORS, graceful shutdown
  internal/store/        SQLite persistence; blocks stored as JSON
  internal/api/          HTTP handlers (CRUD /api/structures)
frontend/                Vite + React 19 + TS + Tailwind v4
  src/store/             Zustand editor store (placement/height/mode logic)
  src/three/             R3F scene: Blocks (instanced + edge culling), Ghost, GridFloor, CameraRig
  src/hooks/             useEditorHotkeys, useCameraControls, usePersistence (all TanStack Hotkeys)
  src/ui/                Toolbar (React Aria), HelpOverlay
```

## Run

Backend (`:8080`):
```
cd backend
go run ./cmd/server
```

Frontend (`:5173`, proxies `/api` -> `:8080`):
```
cd frontend
npm install
npm run dev
```

## Controls

| Input | Action |
|-------|--------|
| W A S D | Move ghost cursor on the grid |
| Space / Enter / Left-click | Place or delete (per active mode) |
| Q / M | Toggle Place / Delete mode |
| ← → | Orbit camera (yaw) |
| ↑ ↓ | Pitch camera (top-down ↔ side-on) |
| Mouse wheel | Zoom |
| Mod+S | Manual save |

Auto-save runs every 2 minutes when there are unsaved changes.

## Rendering

Blocks render as a single `InstancedMesh` (one draw call). Adjacent cubes' shared
faces are coincident and coplanar, so the fill already reads as one solid; internal
edges are culled in `src/three/edges.ts` (an edge is drawn only when 1 or 3 of its 4
surrounding cells are occupied — the silhouette), so the merged structure shows only
its outer borders.

## Data model

A structure is `{ name, gridX, gridY, blocks: [{x,y,z}] }`. Grid (x,y) maps to world
(x,z); stack height z maps to world Y (up). The backend stores `blocks` as a JSON array.

## Cloud / multi-user notes

`VITE_API_BASE` points the client at a hosted backend. CORS in `main.go` is currently
`*` for local dev — tighten `AllowedOrigins` before deploying. Reads go through TanStack
Query (`['structures']` cache) so different devices fetch the same creations.
