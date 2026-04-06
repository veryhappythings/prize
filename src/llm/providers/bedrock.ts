import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Tool,
  type ToolResultBlock,
} from '@aws-sdk/client-bedrock-runtime'
import type { LLMClient } from '../interface.js'

const DEFAULT_MODEL = 'us.anthropic.claude-sonnet-4-6-v1:0'

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

    const command = new ConverseCommand({
      modelId: this.model,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      toolConfig: {
        tools: [tool],
        toolChoice: { tool: { name: toolName } },
      },
      inferenceConfig: { maxTokens: 8096 },
    })

    const response = await this.client.send(command)

    const content = response.output?.message?.content ?? []
    for (const block of content) {
      if (block.toolUse?.name === toolName) {
        return block.toolUse.input as T
      }
    }

    throw new Error(`LLM did not call tool ${toolName}`)
  }
}
