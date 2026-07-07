import type { Structure, StructureInput } from '../types'

// Requests go through the Vite dev proxy (see vite.config.ts). For cloud
// deployment, set VITE_API_BASE to the hosted backend origin.
const BASE = import.meta.env.VITE_API_BASE ?? ''

/** Error carrying the HTTP status so callers can branch on it (e.g. 409). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, `${res.status} ${res.statusText}: ${body}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  list: () => req<Structure[]>('/structures'),
  get: (id: number) => req<Structure>(`/structures/${id}`),
  create: (input: StructureInput) =>
    req<Structure>('/structures', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: StructureInput) =>
    req<Structure>(`/structures/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: number) => req<void>(`/structures/${id}`, { method: 'DELETE' }),
}
