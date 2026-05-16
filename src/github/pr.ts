import { Octokit } from '@octokit/rest'
import type { PRMetadata, PRFile, PRComment, PRData } from './types.js'

export async function fetchPRMetadata(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<PRMetadata> {
  const { data } = await octokit.pulls.get({ owner, repo, pull_number: number })
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    author: data.user?.login ?? 'unknown',
    headBranch: data.head.ref,
    baseBranch: data.base.ref,
    labels: data.labels.map((l) => l.name ?? '').filter(Boolean),
    state: data.state,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
    htmlUrl: data.html_url,
  }
}

export async function fetchPRFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<PRFile[]> {
  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  })
  return files.map((f) => ({
    filename: f.filename,
    status: f.status as PRFile['status'],
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    patch: f.patch,
    previousFilename: f.previous_filename,
  }))
}

export function reconstructDiffFromFiles(files: PRFile[]): string {
  return files
    .map((f) => {
      const header = `diff --git a/${f.filename} b/${f.filename}`
      if (!f.patch) {
        return `${header}\n[patch omitted by GitHub API — file too large]`
      }
      return `${header}\n${f.patch}`
    })
    .join('\n\n')
}

export async function fetchPRDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
  fallbackFiles: PRFile[]
): Promise<string> {
  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: number,
      headers: { accept: 'application/vnd.github.v3.diff' },
    })
    return response.data as unknown as string
  } catch {
    process.stderr.write(
      '[prize] warning: .diff endpoint failed for this PR (likely too large) — falling back to reconstructed diff from per-file patches\n'
    )
    return reconstructDiffFromFiles(fallbackFiles)
  }
}

export async function fetchPRComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<PRComment[]> {
  const [reviewComments, issueComments] = await Promise.all([
    octokit.paginate(octokit.pulls.listReviewComments, {
      owner,
      repo,
      pull_number: number,
      per_page: 100,
    }),
    octokit.paginate(octokit.issues.listComments, {
      owner,
      repo,
      issue_number: number,
      per_page: 100,
    }),
  ])

  const result: PRComment[] = [
    ...reviewComments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.user?.login ?? 'unknown',
      path: c.path,
      line: c.line ?? undefined,
      createdAt: c.created_at,
    })),
    ...issueComments.map((c) => ({
      id: c.id,
      body: c.body ?? '',
      author: c.user?.login ?? 'unknown',
      createdAt: c.created_at,
    })),
  ]

  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function fetchPRData(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<PRData> {
  const [metadata, files, comments] = await Promise.all([
    fetchPRMetadata(octokit, owner, repo, number),
    fetchPRFiles(octokit, owner, repo, number),
    fetchPRComments(octokit, owner, repo, number),
  ])
  const diff = await fetchPRDiff(octokit, owner, repo, number, files)
  return { metadata, files, diff, comments }
}
