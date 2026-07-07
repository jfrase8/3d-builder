/**
 * Returns `desired` if unused, otherwise the first free "base (n)" variant,
 * where base is `desired` with any existing " (n)" suffix stripped so numbering
 * continues a series ("Build (1)" -> "Build (2)") instead of nesting.
 * `taken` holds the names to avoid (compared case-insensitively).
 */
export function uniqueName(desired: string, taken: Set<string>): string {
  const norm = (s: string) => s.trim().toLowerCase()
  if (!taken.has(norm(desired))) return desired
  const base = desired.replace(/\s*\(\d+\)\s*$/, '').trim()
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(norm(candidate))) return candidate
  }
}

/** Set of build names (normalized) excluding the one with `id`. */
export function namesExcept(builds: { id: number; name: string }[], id: number): Set<string> {
  return new Set(builds.filter((b) => b.id !== id).map((b) => b.name.trim().toLowerCase()))
}
