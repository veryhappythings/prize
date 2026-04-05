import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Load a prompt markdown file and interpolate {{variable}} placeholders.
 * Prompt files live in src/llm/prompts/ and are bundled by tsup as text.
 */
export function loadPrompt(name: string, vars: Record<string, string>): string {
  const promptPath = join(__dirname, 'prompts', `${name}.md`)
  let template: string
  try {
    template = readFileSync(promptPath, 'utf-8')
  } catch {
    throw new Error(`Prompt file not found: ${promptPath}`)
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Missing variable "{{${key}}}" in prompt ${name}.md`)
    }
    return vars[key]
  })
}
