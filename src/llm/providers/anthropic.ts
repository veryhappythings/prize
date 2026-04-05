import Anthropic from '@anthropic-ai/sdk'
import type { LLMClient } from '../interface.js'

const DEFAULT_MODEL = 'claude-sonnet-4-6'

export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model ?? DEFAULT_MODEL
  }

  async callWithTool<T>(
    systemPrompt: string,
    userMessage: string,
    toolName: string,
    toolDescription: string,
    inputSchema: Record<string, unknown>
  ): Promise<T> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: inputSchema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
    })

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === toolName) {
        return block.input as T
      }
    }

    throw new Error(`LLM did not call tool ${toolName}`)
  }
}
