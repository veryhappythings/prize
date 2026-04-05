import OpenAI from 'openai'
import type { LLMClient } from '../interface.js'

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
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 8096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
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
      tool_choice: { type: 'function', function: { name: toolName } },
    })

    const message = response.choices[0]?.message
    const toolCall = message?.tool_calls?.find((tc) => tc.function.name === toolName)
    if (!toolCall) {
      throw new Error(`LLM did not call tool ${toolName}`)
    }

    try {
      return JSON.parse(toolCall.function.arguments) as T
    } catch (err) {
      throw new Error(
        `Failed to parse tool arguments as JSON: ${toolCall.function.arguments}\n${err}`
      )
    }
  }
}
