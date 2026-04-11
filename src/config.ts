import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Config {
  githubToken: string
  llmProvider: 'anthropic' | 'openai' | 'bedrock'
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  awsRegion?: string
  cacheDir: string
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN
  const llmProvider = (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai' | 'bedrock'
  const llmApiKey =
    process.env.LLM_API_KEY ?? (llmProvider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined)
  const llmBaseUrl = process.env.LLM_BASE_URL
  const llmModel = process.env.LLM_MODEL
  const awsRegion = process.env.AWS_REGION ?? 'us-east-1'

  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN environment variable is required')
    process.exit(1)
  }

  if (!llmApiKey && llmProvider !== 'bedrock') {
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
    awsRegion,
    cacheDir: join(homedir(), '.prize'),
  }
}
