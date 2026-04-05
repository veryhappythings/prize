export interface PRMetadata {
  number: number
  title: string
  body: string | null
  author: string
  headBranch: string
  baseBranch: string
  labels: string[]
  state: string
  updatedAt: string
  createdAt: string
  additions: number
  deletions: number
  changedFiles: number
  htmlUrl: string
}

export interface PRFile {
  filename: string
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged'
  additions: number
  deletions: number
  changes: number
  patch?: string
  previousFilename?: string
}

export interface PRComment {
  id: number
  body: string
  author: string
  path?: string
  line?: number
  createdAt: string
}

export interface PRData {
  metadata: PRMetadata
  files: PRFile[]
  diff: string
  comments: PRComment[]
}
