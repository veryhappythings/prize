import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Config {
  githubToken: string
  llmProvider: 'anthropic' | 'openai'
  llmApiKey: string
  llmBaseUrl?: string
  llmModel?: string
  cacheDir: string
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN
  const llmProvider = (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai'
  const llmApiKey =
    process.env.LLM_API_KEY ?? (llmProvider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined)
  const llmBaseUrl = process.env.LLM_BASE_URL
  const llmModel = process.env.LLM_MODEL

  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN environment variable is required')
    process.exit(1)
  }

  if (!llmApiKey) {
    if (llmProvider === 'openai') {
      console.error('Error: LLM_API_KEY environment variable is required when LLM_PROVIDER=openai')
    } else {
      console.error('Error: ANTHROPIC_API_KEY (or LLM_API_KEY) environment variable is required')
    }
    process.exit(1)
  }

  return {
    githubToken,
    llmProvider,
    llmApiKey,
    llmBaseUrl,
    llmModel,
    cacheDir: join(homedir(), '.pr-deck'),
  }
}
