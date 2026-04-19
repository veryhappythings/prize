import { describe, it, expect } from 'bun:test'
import { createHash } from 'node:crypto'
import { fileAnchor, fileLink } from '../src/util/pr-links.js'

// Reference implementation: compute the expected hash without using fileAnchor,
// so that encoding bugs in fileAnchor (e.g. added encodeURIComponent, toLowerCase)
// would cause a mismatch here.
function ref(filename: string): string {
  return 'diff-' + createHash('sha256').update(filename, 'utf8').digest('hex')
}

describe('fileAnchor', () => {
  it('produces diff-<sha256> for a plain filename', () => {
    expect(fileAnchor('README.md')).toBe(ref('README.md'))
  })

  it('produces diff-<sha256> for a nested path', () => {
    expect(fileAnchor('src/foo.ts')).toBe(ref('src/foo.ts'))
  })

  it('hashes the exact UTF-8 bytes — spaces are NOT percent-encoded before hashing', () => {
    // If someone adds encodeURIComponent(), spaces become %20 and the hash differs.
    expect(fileAnchor('path with space.ts')).toBe(ref('path with space.ts'))
  })

  it('is case-sensitive — matches GitHub behaviour', () => {
    expect(fileAnchor('Src/Foo.ts')).not.toBe(fileAnchor('src/foo.ts'))
    expect(fileAnchor('Src/Foo.ts')).toBe(ref('Src/Foo.ts'))
  })
})

describe('fileLink', () => {
  it('appends /files#<anchor> to the PR URL', () => {
    const prUrl = 'https://github.com/o/r/pull/1'
    expect(fileLink(prUrl, 'src/foo.ts')).toBe(`${prUrl}/files#${fileAnchor('src/foo.ts')}`)
  })

  it('anchor portion equals fileAnchor() — round-trip', () => {
    const url = fileLink('https://github.com/o/r/pull/99', 'src/util/pr-links.ts')
    expect(url.split('#')[1]).toBe(fileAnchor('src/util/pr-links.ts'))
  })
})
