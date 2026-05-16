import { describe, it, expect, mock } from 'bun:test'
import { reconstructDiffFromFiles, fetchPRDiff } from '../src/github/pr.js'
import type { PRFile } from '../src/github/types.js'

const file = (filename: string, patch?: string): PRFile => ({
  filename,
  status: 'modified',
  additions: 1,
  deletions: 1,
  changes: 2,
  patch,
})

describe('reconstructDiffFromFiles', () => {
  it('produces a header and patch for each file', () => {
    const result = reconstructDiffFromFiles([file('src/foo.ts', '@@ -1 +1 @@\n-old\n+new')])
    expect(result).toContain('diff --git a/src/foo.ts b/src/foo.ts')
    expect(result).toContain('@@ -1 +1 @@')
    expect(result).toContain('+new')
  })

  it('uses placeholder for files with no patch', () => {
    const result = reconstructDiffFromFiles([file('big.ts')])
    expect(result).toContain('diff --git a/big.ts b/big.ts')
    expect(result).toContain('[patch omitted by GitHub API — file too large]')
  })

  it('joins multiple files with blank lines', () => {
    const result = reconstructDiffFromFiles([file('a.ts', '+a'), file('b.ts', '+b')])
    expect(result).toContain('diff --git a/a.ts b/a.ts')
    expect(result).toContain('diff --git a/b.ts b/b.ts')
  })
})

describe('fetchPRDiff', () => {
  const files = [file('src/foo.ts', '@@ -1 +1 @@\n+hello')]

  it('returns GitHub diff on success', async () => {
    const octokit = {
      request: mock(async () => ({ data: 'diff content from github' })),
    } as any
    const result = await fetchPRDiff(octokit, 'owner', 'repo', 1, files)
    expect(result).toBe('diff content from github')
  })

  it('falls back to reconstruction when .diff endpoint throws', async () => {
    const octokit = {
      request: mock(async () => {
        throw Object.assign(new Error('too large'), { status: 406 })
      }),
    } as any
    const result = await fetchPRDiff(octokit, 'owner', 'repo', 1, files)
    expect(result).toContain('diff --git a/src/foo.ts b/src/foo.ts')
    expect(result).toContain('+hello')
  })
})
