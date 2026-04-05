import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Config {
  githubToken: string
  anthropicApiKey: string
  cacheDir: string
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN environment variable is required')
    process.exit(1)
  }
  if (!anthropicApiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required')
    process.exit(1)
  }

  return {
    githubToken,
    anthropicApiKey,
    cacheDir: join(homedir(), '.review-monster'),
  }
}
