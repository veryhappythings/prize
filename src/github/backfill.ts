import { createPatch } from 'diff'
import type { Octokit } from '@octokit/rest'
import type { PRFile } from './types.js'

const PATCH_SIZE_CAP = 500 * 1024 // 500 KB

const BINARY_EXTENSIONS = new Set([
  '.jar', '.class', '.so', '.dylib', '.dll', '.exe',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.wav', '.ogg', '.mov', '.avi',
  '.pyc', '.pyo',
])

function isBinaryByExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}

async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const response = await octokit.repos.getContent({ owner, repo, path, ref })
    const data = response.data
    if (Array.isArray(data) || data.type !== 'file') return null
    return Buffer.from(data.content, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

function capPatch(patch: string, filename: string): string {
  if (patch.length <= PATCH_SIZE_CAP) return patch
  const truncated = patch.slice(0, PATCH_SIZE_CAP)
  const lastNewline = truncated.lastIndexOf('\n')
  return (lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated) +
    `\n[diff truncated — file too large; view full diff on GitHub: ${filename}]`
}

async function backfillFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  file: PRFile,
  baseSha: string,
  headSha: string
): Promise<string> {
  if (isBinaryByExtension(file.filename)) {
    return `[Binary file — view on GitHub]`
  }

  const status = file.status

  if (status === 'added') {
    const content = await fetchFileContent(octokit, owner, repo, file.filename, headSha)
    if (content === null) return `[Content unavailable — view on GitHub]`
    const patch = createPatch(file.filename, '', content, '', '')
    // strip the diff header lines (--- /dev/null, +++ b/file) — keep only the hunks
    const hunks = patch.split('\n').slice(4).join('\n')
    return capPatch(hunks, file.filename)
  }

  if (status === 'removed') {
    const content = await fetchFileContent(octokit, owner, repo, file.filename, baseSha)
    if (content === null) return `[Content unavailable — view on GitHub]`
    const patch = createPatch(file.filename, content, '', '', '')
    const hunks = patch.split('\n').slice(4).join('\n')
    return capPatch(hunks, file.filename)
  }

  // modified / renamed / copied / changed / unchanged
  const sourcePath = file.previousFilename ?? file.filename
  const [baseContent, headContent] = await Promise.all([
    fetchFileContent(octokit, owner, repo, sourcePath, baseSha),
    fetchFileContent(octokit, owner, repo, file.filename, headSha),
  ])
  if (baseContent === null || headContent === null) {
    return `[Content unavailable — view on GitHub]`
  }
  const patch = createPatch(file.filename, baseContent, headContent, '', '')
  const hunks = patch.split('\n').slice(4).join('\n')
  return capPatch(hunks, file.filename)
}

export async function backfillMissingPatches(
  octokit: Octokit,
  owner: string,
  repo: string,
  files: PRFile[],
  baseSha: string,
  headSha: string
): Promise<void> {
  const missing = files.filter((f) => f.patch == null)
  if (missing.length === 0) return

  process.stderr.write(
    `[prize] backfilling patches for ${missing.length} file(s) omitted by GitHub API...\n`
  )

  const CONCURRENCY = 5
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const patches = await Promise.all(
      batch.map((f) => backfillFile(octokit, owner, repo, f, baseSha, headSha))
    )
    for (let j = 0; j < batch.length; j++) {
      batch[j].patch = patches[j]
    }
  }
}
