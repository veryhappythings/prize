import type { LLMClient } from './interface.js'
import { loadPrompt } from './load-prompt.js'
import type { PRData } from '../github/types.js'
import type { OverviewAnalysis } from './types.js'
import { normalizeC4 } from '../diagrams/c4.js'

export async function analyzeOverview(
  client: LLMClient,
  prData: PRData
): Promise<OverviewAnalysis> {
  const fileList = prData.files
    .map((f) => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`)
    .join('\n')

  const prompt = loadPrompt('overview', {
    prTitle: prData.metadata.title,
    prAuthor: prData.metadata.author,
    headBranch: prData.metadata.headBranch,
    baseBranch: prData.metadata.baseBranch,
    labels: prData.metadata.labels.join(', ') || 'none',
    additions: String(prData.metadata.additions),
    deletions: String(prData.metadata.deletions),
    changedFiles: String(prData.metadata.changedFiles),
    prBody: prData.metadata.body || '(no description)',
    fileList,
  })

  const result = await client.callWithTool<OverviewAnalysis>(
    'You are an expert software engineer doing code review preparation.',
    prompt,
    'submit_overview',
    'Submit the high-level overview analysis of the PR',
    {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One or two sentence summary of what this PR does' },
        motivation: { type: 'string', description: 'Why this change is being made — one sentence' },
        risks: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of risks or areas of concern',
        },
        jiraTicket: {
          type: 'string',
          description: 'Jira ticket ID (e.g. "ABC-123") or null if not found',
          nullable: true,
        },
        c4Context: {
          type: 'string',
          description:
            'C4 model context as 2–3 short paragraphs separated by blank lines. Cover the System (what product/service), Containers (apps/services/databases involved), and Components (modules/classes) affected — one paragraph per level, skipping any level not relevant.',
        },
        c4Diagram: {
          type: 'object',
          nullable: true,
          description:
            'Structured C4 model of the part of the system this PR touches, rendered as a diagram. Null only if the PR has no architectural footprint (e.g. docs or formatting only).',
          properties: {
            elements: {
              type: 'array',
              description: '4–15 elements. Include the people and external systems that interact with the system, its containers, and components only inside containers the PR changes.',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Short unique snake_case id' },
                  name: { type: 'string', description: 'Display name, 1–4 words' },
                  kind: {
                    type: 'string',
                    enum: ['person', 'system', 'external-system', 'container', 'database', 'component'],
                  },
                  technology: { type: 'string', nullable: true, description: 'e.g. "TypeScript, Bun" or "PostgreSQL"; null for people' },
                  description: { type: 'string', description: 'What it does, at most 15 words' },
                  boundary: { type: 'string', nullable: true, description: 'id of the enclosing boundary, or null' },
                  changed: { type: 'boolean', description: 'true if this PR modifies this element' },
                },
                required: ['id', 'name', 'kind', 'technology', 'description', 'boundary', 'changed'],
              },
            },
            boundaries: {
              type: 'array',
              description: 'Grouping boxes: usually the software system being changed, and optionally a container boundary around its components.',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Short unique snake_case id, distinct from element ids' },
                  name: { type: 'string' },
                  parent: { type: 'string', nullable: true, description: 'id of the enclosing boundary, or null' },
                },
                required: ['id', 'name', 'parent'],
              },
            },
            relationships: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: 'Source element id' },
                  to: { type: 'string', description: 'Target element id' },
                  label: { type: 'string', description: 'Verb phrase, at most 6 words, e.g. "Reads PR data from"' },
                  technology: { type: 'string', nullable: true, description: 'Protocol or mechanism, e.g. "HTTPS/JSON"' },
                  changed: { type: 'boolean', description: 'true if this PR adds or changes this interaction' },
                },
                required: ['from', 'to', 'label', 'technology', 'changed'],
              },
            },
          },
          required: ['elements', 'boundaries', 'relationships'],
        },
        affectedAreas: {
          type: 'array',
          items: { type: 'string' },
          description: 'High-level areas of the codebase affected (e.g. "authentication", "database layer")',
        },
      },
      required: ['summary', 'motivation', 'risks', 'jiraTicket', 'c4Context', 'c4Diagram', 'affectedAreas'],
    }
  )

  return { ...result, c4Diagram: normalizeC4(result.c4Diagram) }
}
