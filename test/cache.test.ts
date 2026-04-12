import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Cache } from '../src/cache/index.js'

describe('Cache', () => {
  let tmpDir: string
  let cache: Cache

  beforeEach(() => {
    tmpDir = join(tmpdir(), `rm-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    cache = new Cache(tmpDir, 'test-pr')
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('stores and retrieves JSON values', () => {
    cache.set('pr-metadata', { title: 'Hello' })
    expect(cache.get('pr-metadata')).toEqual({ title: 'Hello' })
  })

  it('reports has() correctly', () => {
    expect(cache.has('pr-metadata')).toBe(false)
    cache.set('pr-metadata', { x: 1 })
    expect(cache.has('pr-metadata')).toBe(true)
  })

  it('stores and retrieves text (diff)', () => {
    cache.setText('pr-diff', 'diff --git a/foo.ts...')
    expect(cache.getText('pr-diff')).toBe('diff --git a/foo.ts...')
  })

  it('invalidateFrom removes the key and all downstream keys', () => {
    cache.set('pr-metadata', {})
    cache.set('pr-files', [])
    cache.set('analysis-overview', {})
    cache.set('analysis-structure', {})

    cache.invalidateFrom('analysis-overview')

    expect(cache.has('pr-metadata')).toBe(true)
    expect(cache.has('pr-files')).toBe(true)
    expect(cache.has('analysis-overview')).toBe(false)
    expect(cache.has('analysis-structure')).toBe(false)
  })

  it('returns null for missing keys', () => {
    expect(cache.get('sections')).toBeNull()
    expect(cache.getText('pr-diff')).toBeNull()
  })
})
