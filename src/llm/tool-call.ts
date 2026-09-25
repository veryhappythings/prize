// Newer models (e.g. Claude Opus 5.5) reject forced tool use (`tool_choice` of
// type `tool`/`any`), so providers use `auto` and steer from the prompt instead.
// Because `auto` doesn't guarantee a call, retry a few times if none is made.

const MAX_ATTEMPTS = 3

export function withToolInstruction(userMessage: string, toolName: string): string {
  return `${userMessage}\n\nSubmit your answer by calling the \`${toolName}\` tool exactly once. Do not reply with plain text.`
}

export async function requireToolCall<T>(
  toolName: string,
  attempt: () => Promise<T | undefined>
): Promise<T> {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const result = await attempt()
    if (result !== undefined) return result
    if (i < MAX_ATTEMPTS) {
      process.stderr.write(`[prize] LLM did not call ${toolName} — retrying (attempt ${i + 1}/${MAX_ATTEMPTS})...\n`)
    }
  }
  throw new Error(`LLM did not call tool ${toolName} after ${MAX_ATTEMPTS} attempts`)
}
