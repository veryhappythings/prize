import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime'
import type { LLMClient } from '../interface.js'
import { withRateLimit } from '../retry.js'
import { requireToolCall, withToolInstruction } from '../tool-call.js'

const DEFAULT_MODEL = 'anthropic.claude-opus-5-5'

export class BedrockLLMClient implements LLMClient {
  private client: BedrockRuntimeClient
  private model: string

  constructor(region: string, model?: string) {
    this.client = new BedrockRuntimeClient({ region })
    this.model = model ?? DEFAULT_MODEL
  }

  async callWithTool<T>(
    systemPrompt: string,
    userMessage: string,
    toolName: string,
    toolDescription: string,
    inputSchema: Record<string, unknown>
  ): Promise<T> {
    const tool: Tool = {
      toolSpec: {
        name: toolName,
        description: toolDescription,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: { json: inputSchema as any },
      },
    }

    return requireToolCall(toolName, async () => {
      // No toolChoice (i.e. auto): Opus 5.5 rejects forced tool use.
      const command = new ConverseCommand({
        modelId: this.model,
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: withToolInstruction(userMessage, toolName) }] }],
        toolConfig: { tools: [tool] },
        // Thinking is always on for Opus 5.5 and counts toward maxTokens
        inferenceConfig: { maxTokens: 32000 },
      })

      const response = await withRateLimit(() => this.client.send(command))

      const content = response.output?.message?.content ?? []
      for (const block of content) {
        if (block.toolUse?.name === toolName) {
          return block.toolUse.input as T
        }
      }
      return undefined
    })
  }
}
