import type { LLMClient } from './interface.js'
import { AnthropicLLMClient } from './providers/anthropic.js'
import { OpenAILLMClient } from './providers/openai.js'
import type { Config } from '../config.js'

export function createLLMClient(config: Config): LLMClient {
  if (config.llmProvider === 'openai') {
    return new OpenAILLMClient(config.llmApiKey, config.llmModel, config.llmBaseUrl)
  }
  return new AnthropicLLMClient(config.llmApiKey, config.llmModel)
}
