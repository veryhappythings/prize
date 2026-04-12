import { describe, it, expect } from 'bun:test'
import { parsePRUrl, prCacheKey } from '../src/util/parse-url.js'

describe('parsePRUrl', () => {
  it('parses a standard GitHub PR URL', () => {
    const ref = parsePRUrl('https://github.com/facebook/react/pull/12345')
    expect(ref).toEqual({ owner: 'facebook', repo: 'react', number: 12345 })
  })

  it('parses a URL with a trailing slash', () => {
    const ref = parsePRUrl('https://github.com/my-org/my-repo/pull/1/')
    expect(ref.owner).toBe('my-org')
    expect(ref.repo).toBe('my-repo')
    expect(ref.number).toBe(1)
  })

  it('parses a URL with query params', () => {
    const ref = parsePRUrl('https://github.com/owner/repo/pull/42?diff=split')
    expect(ref.number).toBe(42)
  })

  it('throws on an invalid URL', () => {
    expect(() => parsePRUrl('https://github.com/owner/repo')).toThrow('Invalid GitHub PR URL')
  })

  it('throws on a non-GitHub URL', () => {
    expect(() => parsePRUrl('https://gitlab.com/owner/repo/merge_requests/1')).toThrow('Invalid GitHub PR URL')
  })
})

describe('prCacheKey', () => {
  it('produces a stable cache key', () => {
    expect(prCacheKey({ owner: 'facebook', repo: 'react', number: 123 })).toBe('facebook-react-123')
  })
})
