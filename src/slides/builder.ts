import type { PRData } from '../github/types.js'
import type { AllAnalysis } from '../llm/types.js'
import type { SlideDeck, SlideGroup, Slide } from './types.js'

export function buildSlideDeck(prData: PRData, analysis: AllAnalysis): SlideDeck {
  const { overview, structure, details } = analysis
  const { metadata, files } = prData

  const groups: SlideGroup[] = []

  // 1. Title slide (standalone)
  groups.push({
    main: {
      type: 'title',
      prTitle: metadata.title,
      prUrl: metadata.htmlUrl,
      author: metadata.author,
      repo: `${metadata.headBranch.split('/')[0]}`, // best effort
      date: new Date(metadata.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      jiraTicket: overview.jiraTicket === 'null' ? null : overview.jiraTicket,
    },
    sub: [],
  })

  // 2. Overview slide (standalone)
  groups.push({
    main: {
      type: 'overview',
      summary: overview.summary,
      motivation: overview.motivation,
      c4Context: overview.c4Context,
      affectedAreas: overview.affectedAreas,
      risks: overview.risks,
      totalFiles: metadata.changedFiles,
      additions: metadata.additions,
      deletions: metadata.deletions,
    },
    sub: [],
  })

  // 3. Map slide — table of contents
  const orderedPieces = structure.reviewOrder
    .map((id) => structure.pieces.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  groups.push({
    main: {
      type: 'map',
      pieces: orderedPieces.map((p) => ({ name: p.name, description: p.description })),
    },
    sub: [],
  })

  // 4. One group per piece (horizontal navigation)
  orderedPieces.forEach((piece, idx) => {
    const detail = details[piece.id]
    const sub: Slide[] = []

    // UML diagram (if available)
    if (detail?.mermaidCode) {
      sub.push({ type: 'uml', pieceName: piece.name, mermaidCode: detail.mermaidCode })
    }

    // Signatures slide
    if (detail?.signatures?.length) {
      sub.push({ type: 'signatures', pieceName: piece.name, signatures: detail.signatures })
    }

    // Walkthrough slide
    if (detail?.walkthrough) {
      sub.push({ type: 'walkthrough', pieceName: piece.name, walkthrough: detail.walkthrough })
    }

    // Code slides — one per file in the piece
    const pieceFileSet = new Set(piece.files)
    for (const f of files) {
      if (pieceFileSet.has(f.filename) && f.patch) {
        sub.push({
          type: 'code',
          pieceName: piece.name,
          filename: f.filename,
          patch: f.patch,
          status: f.status,
        })
      }
    }

    // Issues slide (if any)
    if (detail?.issues?.length) {
      sub.push({ type: 'issues', pieceName: piece.name, issues: detail.issues })
    }

    groups.push({
      main: {
        type: 'piece-summary',
        pieceIndex: idx + 1,
        totalPieces: orderedPieces.length,
        name: piece.name,
        description: piece.description,
        files: piece.files,
      },
      sub,
    })
  })

  // 5. Summary slide
  groups.push({
    main: {
      type: 'summary',
      summary: overview.summary,
      risks: overview.risks,
      totalFiles: metadata.changedFiles,
      additions: metadata.additions,
      deletions: metadata.deletions,
    },
    sub: [],
  })

  return { prTitle: metadata.title, groups }
}
