import { Octokit } from '@octokit/rest'

let _octokit: Octokit | null = null

export function getOctokit(token: string): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: token })
  }
  return _octokit
}
