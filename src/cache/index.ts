import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// Ordered cache keys — invalidating one invalidates all downstream
export const CACHE_KEYS = [
  'pr-metadata',
  'pr-files',
  'pr-diff',
  'analysis-overview',
  'analysis-structure',
  'analysis-details',
  'sections',
] as const

export type CacheKey = (typeof CACHE_KEYS)[number]

export class Cache {
  private dir: string

  constructor(baseDir: string, prKey: string) {
    this.dir = join(baseDir, prKey)
    mkdirSync(this.dir, { recursive: true })
  }

  has(key: CacheKey): boolean {
    return existsSync(this.filePath(key))
  }

  get<T>(key: CacheKey): T | null {
    const path = this.filePath(key)
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as T
    } catch {
      return null
    }
  }

  set<T>(key: CacheKey, data: T): void {
    writeFileSync(this.filePath(key), JSON.stringify(data, null, 2), 'utf-8')
  }

  /** Invalidate this key and all downstream keys */
  invalidateFrom(key: CacheKey): void {
    const idx = CACHE_KEYS.indexOf(key)
    if (idx === -1) return
    for (const k of CACHE_KEYS.slice(idx)) {
      const path = this.filePath(k)
      if (existsSync(path)) {
        rmSync(path)
      }
    }
  }

  private filePath(key: CacheKey): string {
    // pr-diff is stored as text, not JSON
    const ext = key === 'pr-diff' ? 'txt' : 'json'
    return join(this.dir, `${key}.${ext}`)
  }

  // Special handling for text (diff)
  getText(key: CacheKey): string | null {
    const path = this.filePath(key)
    if (!existsSync(path)) return null
    return readFileSync(path, 'utf-8')
  }

  setText(key: CacheKey, data: string): void {
    writeFileSync(this.filePath(key), data, 'utf-8')
  }
}
