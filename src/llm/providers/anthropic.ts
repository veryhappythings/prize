import Anthropic from '@anthropic-ai/sdk'
import type { LLMClient } from '../interface.js'
import { withRateLimit } from '../retry.js'
import { requireToolCall, withToolInstruction } from '../tool-call.js'

const DEFAULT_MODEL = 'claude-opus-5-5'

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
    return requireToolCall(toolName, async () => {
      // Thinking is always on for Opus 5.5 and counts toward max_tokens, so leave
      // plenty of headroom and stream to avoid HTTP timeouts.
      const response = await withRateLimit(() => this.client.messages.stream({
        model: this.model,
        max_tokens: 64000,
        output_config: { effort: 'high' },
        system: systemPrompt,
        messages: [{ role: 'user', content: withToolInstruction(userMessage, toolName) }],
        tools: [
          {
            name: toolName,
            description: toolDescription,
            input_schema: inputSchema as Anthropic.Tool['input_schema'],
          },
        ],
        tool_choice: { type: 'auto' },
      }).finalMessage())

      if (response.stop_reason === 'refusal') {
        throw new Error(`LLM declined the request (${response.stop_details?.category ?? 'unknown category'})`)
      }

      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === toolName) {
          return block.input as T
        }
      }
      return undefined
    })
  }
}
