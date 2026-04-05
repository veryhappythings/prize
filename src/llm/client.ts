import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(apiKey: string): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export async function callWithTool<T>(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  toolName: string,
  toolDescription: string,
  inputSchema: Anthropic.Tool['input_schema']
): Promise<T> {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: inputSchema,
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
