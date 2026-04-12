import overviewPrompt from './prompts/overview.md' with { type: 'text' }
import structurePrompt from './prompts/structure.md' with { type: 'text' }
import detailPrompt from './prompts/detail.md' with { type: 'text' }

const PROMPTS: Record<string, string> = {
  overview: overviewPrompt,
  structure: structurePrompt,
  detail: detailPrompt,
}

/**
 * Load a prompt markdown file and interpolate {{variable}} placeholders.
 * Prompts are bundled as embedded text at build time.
 */
export function loadPrompt(name: string, vars: Record<string, string>): string {
  const template = PROMPTS[name]
  if (!template) throw new Error(`Prompt not found: ${name}.md`)
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Missing variable "{{${key}}}" in prompt ${name}.md`)
    }
    return vars[key]
  })
}
