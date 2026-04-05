import type { LLMClient } from './interface.js'
import { loadPrompt } from './load-prompt.js'
import type { PRFile } from '../github/types.js'
import type { Piece, DetailAnalysis } from './types.js'

function extractPieceDiff(files: PRFile[], pieceFiles: string[]): string {
  const pieceFileSet = new Set(pieceFiles)
  const relevant = files.filter((f) => pieceFileSet.has(f.filename))
  if (relevant.length === 0) return '(no diff available for these files)'
  return relevant
    .map((f) => {
      if (!f.patch) return `--- ${f.filename} (no patch available) ---`
      return `--- ${f.filename} ---\n${f.patch}`
    })
    .join('\n\n')
}

export async function analyzeDetail(
  client: LLMClient,
  piece: Piece,
  files: PRFile[]
): Promise<DetailAnalysis> {
  const pieceDiff = extractPieceDiff(files, piece.files)
  const umlInstruction = piece.suggestUml
    ? `For the mermaidCode field: generate a ${piece.umlType} diagram showing ${piece.umlDescription}. Use valid Mermaid syntax.`
    : 'For the mermaidCode field: return null (no diagram needed for this piece).'

  const prompt = loadPrompt('detail', {
    pieceName: piece.name,
    pieceDescription: piece.description,
    pieceFiles: piece.files.join(', '),
    pieceDiff,
    umlInstruction,
  })

  const result = await client.callWithTool<Omit<DetailAnalysis, 'pieceId'>>(
    'You are an expert software engineer doing code review preparation.',
    prompt,
    'submit_detail',
    'Submit the detailed analysis for this piece of the PR',
    {
      type: 'object',
      properties: {
        pieceSummary: { type: 'string', description: 'Concise summary of what this piece does' },
        signatures: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Method/function/class name' },
              file: { type: 'string', description: 'File path' },
              explanation: { type: 'string', description: 'One-sentence explanation of what it does' },
            },
            required: ['name', 'file', 'explanation'],
          },
        },
        walkthrough: { type: 'string', description: '3-8 sentence guided walkthrough of the implementation' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              description: { type: 'string' },
            },
            required: ['severity', 'description'],
          },
        },
        mermaidCode: {
          type: 'string',
          description: 'Mermaid diagram code, or null if no diagram',
          nullable: true,
        },
      },
      required: ['pieceSummary', 'signatures', 'walkthrough', 'issues', 'mermaidCode'],
    }
  )

  return { ...result, pieceId: piece.id }
}

export async function analyzeAllDetails(
  client: LLMClient,
  pieces: Piece[],
  files: PRFile[],
  onProgress?: (pieceId: string) => void
): Promise<Record<string, DetailAnalysis>> {
  const results: Record<string, DetailAnalysis> = {}

  // Process with limited concurrency to respect rate limits
  const CONCURRENCY = 3
  for (let i = 0; i < pieces.length; i += CONCURRENCY) {
    const batch = pieces.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((piece) =>
        analyzeDetail(client, piece, files).then((result) => {
          onProgress?.(piece.id)
          return result
        })
      )
    )
    for (const result of batchResults) {
      results[result.pieceId] = result
    }
  }

  return results
}
