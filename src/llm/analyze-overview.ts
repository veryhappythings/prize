import type Anthropic from '@anthropic-ai/sdk'
import { callWithTool } from './client.js'
import { loadPrompt } from './load-prompt.js'
import type { PRData } from '../github/types.js'
import type { OverviewAnalysis } from './types.js'

export async function analyzeOverview(
  client: Anthropic,
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

  return callWithTool<OverviewAnalysis>(
    client,
    'You are an expert software engineer doing code review preparation.',
    prompt,
    'submit_overview',
    'Submit the high-level overview analysis of the PR',
    {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One paragraph summary of what this PR does' },
        motivation: { type: 'string', description: 'Why this change is being made' },
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
          description: 'C4 model context: which system/container/component is affected and how',
        },
        affectedAreas: {
          type: 'array',
          items: { type: 'string' },
          description: 'High-level areas of the codebase affected (e.g. "authentication", "database layer")',
        },
      },
      required: ['summary', 'motivation', 'risks', 'jiraTicket', 'c4Context', 'affectedAreas'],
    }
  )
}
