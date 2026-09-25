import OpenAI from 'openai'
import type { LLMClient } from '../interface.js'
import { withRateLimit } from '../retry.js'
import { requireToolCall, withToolInstruction } from '../tool-call.js'

interface FunctionToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const DEFAULT_MODEL = 'gpt-4o'

export class OpenAILLMClient implements LLMClient {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model?: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL })
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
      const response = await withRateLimit(() => this.client.chat.completions.create({
        model: this.model,
        max_tokens: 16000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: withToolInstruction(userMessage, toolName) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: toolName,
              description: toolDescription,
              parameters: inputSchema,
            },
          },
        ],
        // auto rather than forced: some models (e.g. Claude Opus 5.5 via OpenRouter) reject forced tool use
        tool_choice: 'auto',
      }))

      const message = response.choices[0]?.message
      const toolCall = message?.tool_calls?.find(
        (tc): tc is FunctionToolCall =>
          tc.type === 'function' && (tc as FunctionToolCall).function.name === toolName
      )
      if (!toolCall) return undefined

      try {
        return JSON.parse(toolCall.function.arguments) as T
      } catch (err) {
        throw new Error(
          `Failed to parse tool arguments as JSON: ${toolCall.function.arguments}\n${err}`
        )
      }
    })
  }
}
