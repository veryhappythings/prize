import type { LLMClient } from './interface.js'
import { loadPrompt } from './load-prompt.js'
import type { OverviewAnalysis, StructureAnalysis } from './types.js'

export async function analyzeStructure(
  client: LLMClient,
  overview: OverviewAnalysis,
  diff: string
): Promise<StructureAnalysis> {
  // Truncate very large diffs to stay within context limits
  const maxDiffChars = 80_000
  const truncatedDiff =
    diff.length > maxDiffChars
      ? diff.slice(0, maxDiffChars) + '\n\n[... diff truncated for context window ...]'
      : diff

  const prompt = loadPrompt('structure', {
    summary: overview.summary,
    motivation: overview.motivation,
    c4Context: overview.c4Context,
    affectedAreas: overview.affectedAreas.join(', '),
    diff: truncatedDiff,
  })

  return client.callWithTool<StructureAnalysis>(
    'You are an expert software engineer doing code review preparation.',
    prompt,
    'submit_structure',
    'Submit the structural decomposition of the PR into logical pieces',
    {
      type: 'object',
      properties: {
        pieces: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Short slug ID for this piece (e.g. "auth-middleware")' },
              name: { type: 'string', description: 'Human-readable name for this piece' },
              description: { type: 'string', description: 'What this piece does and why' },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'File paths involved in this piece',
              },
              suggestUml: { type: 'boolean', description: 'Whether a UML diagram would help understand this piece' },
              umlType: {
                type: 'string',
                description: 'Type of UML diagram: "class", "sequence", "state", "flowchart", or "er"',
                nullable: true,
              },
              umlDescription: {
                type: 'string',
                description: 'Brief description of what the diagram should show',
                nullable: true,
              },
            },
            required: ['id', 'name', 'description', 'files', 'suggestUml', 'umlType', 'umlDescription'],
          },
        },
        reviewOrder: {
          type: 'array',
          items: { type: 'string' },
          description: 'Piece IDs in the recommended review order',
        },
      },
      required: ['pieces', 'reviewOrder'],
    }
  )
}
