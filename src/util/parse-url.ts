export interface PRRef {
  owner: string
  repo: string
  number: number
}

const PR_URL_PATTERN = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/

export function parsePRUrl(url: string): PRRef {
  const match = url.match(PR_URL_PATTERN)
  if (!match) {
    throw new Error(
      `Invalid GitHub PR URL: ${url}\nExpected format: https://github.com/<owner>/<repo>/pull/<number>`
    )
  }
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  }
}

export function prCacheKey(ref: PRRef): string {
  return `${ref.owner}-${ref.repo}-${ref.number}`
}
