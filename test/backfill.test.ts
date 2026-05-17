import { describe, it, expect, mock } from 'bun:test'
import { backfillMissingPatches } from '../src/github/backfill.js'
import type { PRFile } from '../src/github/types.js'

const file = (filename: string, overrides: Partial<PRFile> = {}): PRFile => ({
  filename,
  status: 'added',
  additions: 10,
  deletions: 0,
  changes: 10,
  ...overrides,
})

function mockOctokit(contentsByPath: Record<string, string | null>) {
  return {
    repos: {
      getContent: mock(async ({ path }: { path: string }) => {
        const content = contentsByPath[path]
        if (content === null) throw new Error('Not Found')
        return {
          data: {
            type: 'file',
            content: Buffer.from(content).toString('base64'),
          },
        }
      }),
    },
  } as any
}

describe('backfillMissingPatches', () => {
  it('does nothing when all files already have patches', async () => {
    const files = [file('src/a.ts', { patch: '@@ -1 +1 @@\n+hello' })]
    const octokit = mockOctokit({})
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch).toBe('@@ -1 +1 @@\n+hello')
    expect(octokit.repos.getContent).not.toHaveBeenCalled()
  })

  it('fills patch for an added file with content from head', async () => {
    const files = [file('src/new.ts')]
    const octokit = mockOctokit({ 'src/new.ts': 'const x = 1\n' })
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch).toBeTruthy()
    expect(files[0].patch).toContain('+const x = 1')
  })

  it('fills patch for a removed file with content from base', async () => {
    const files = [file('src/old.ts', { status: 'removed' })]
    const octokit = mockOctokit({ 'src/old.ts': 'const y = 2\n' })
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch).toBeTruthy()
    expect(files[0].patch).toContain('-const y = 2')
  })

  it('fills patch for a modified file by diffing base and head', async () => {
    const files = [file('src/mod.ts', { status: 'modified' })]
    const octokit = mockOctokit({ 'src/mod.ts': 'const z = 3\n' })
    // same content returned for both refs — patch will be empty (no-op diff)
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch).toBeDefined()
  })

  it('sets binary placeholder for known binary extensions without fetching', async () => {
    const files = [file('lib/things.jar')]
    const octokit = mockOctokit({})
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch).toContain('Binary file')
    expect(octokit.repos.getContent).not.toHaveBeenCalled()
  })

  it('sets unavailable placeholder when content fetch fails', async () => {
    const files = [file('src/big.ts')]
    const octokit = mockOctokit({ 'src/big.ts': null })
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch).toContain('unavailable')
  })

  it('truncates patch when it exceeds the 500 KB cap', async () => {
    const hugeLine = 'x'.repeat(1000)
    const content = Array(600).fill(hugeLine).join('\n') + '\n'
    const files = [file('src/huge.ts')]
    const octokit = mockOctokit({ 'src/huge.ts': content })
    await backfillMissingPatches(octokit, 'owner', 'repo', files, 'base-sha', 'head-sha')
    expect(files[0].patch!.length).toBeLessThan(520 * 1024)
    expect(files[0].patch).toContain('truncated')
  })
})
