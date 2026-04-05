import { describe, it, expect } from 'vitest'
import { buildSlideDeck } from '../src/slides/builder.js'
import type { PRData, PRMetadata, PRFile } from '../src/github/types.js'
import type { AllAnalysis, OverviewAnalysis, StructureAnalysis, DetailAnalysis } from '../src/llm/types.js'
import type { TitleSlide, OverviewSlide, SummarySlide, PieceSummarySlide } from '../src/slides/types.js'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeMetadata(overrides: Partial<PRMetadata> = {}): PRMetadata {
  return {
    number: 1,
    title: 'Fix the thing',
    body: null,
    author: 'alice',
    headBranch: 'fix/thing',
    baseBranch: 'main',
    labels: [],
    state: 'open',
    updatedAt: '2024-01-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    additions: 10,
    deletions: 2,
    changedFiles: 3,
    htmlUrl: 'https://github.com/owner/repo/pull/1',
    ...overrides,
  }
}

function makeFile(filename: string, overrides: Partial<PRFile> = {}): PRFile {
  return {
    filename,
    status: 'modified',
    additions: 5,
    deletions: 1,
    changes: 6,
    patch: `@@ -1,1 +1,2 @@\n-old\n+new`,
    ...overrides,
  }
}

function makePRData(overrides: { metadata?: Partial<PRMetadata>; files?: PRFile[] } = {}): PRData {
  return {
    metadata: makeMetadata(overrides.metadata),
    files: overrides.files ?? [makeFile('src/foo.ts'), makeFile('src/bar.ts')],
    diff: 'diff content',
    comments: [],
  }
}

function makeOverview(overrides: Partial<OverviewAnalysis> = {}): OverviewAnalysis {
  return {
    summary: 'A summary.',
    motivation: 'A motivation.',
    risks: ['Risk one'],
    jiraTicket: null,
    c4Context: 'C4 context.',
    affectedAreas: ['auth'],
    ...overrides,
  }
}

function makeStructure(pieces: StructureAnalysis['pieces'] = [], reviewOrder?: string[]): StructureAnalysis {
  return {
    pieces,
    reviewOrder: reviewOrder ?? pieces.map((p) => p.id),
  }
}

function makePiece(id: string, files: string[] = []) {
  return { id, name: `Piece ${id}`, description: `Desc for ${id}`, files, suggestUml: false, umlType: null, umlDescription: null }
}

function makeDetail(pieceId: string, overrides: Partial<DetailAnalysis> = {}): DetailAnalysis {
  return {
    pieceId,
    pieceSummary: 'Summary.',
    signatures: [],
    walkthrough: 'Walk.',
    issues: [],
    mermaidCode: null,
    ...overrides,
  }
}

function makeAnalysis(
  overrideOverview: Partial<OverviewAnalysis> = {},
  structure: StructureAnalysis = makeStructure(),
  details: Record<string, DetailAnalysis> = {},
): AllAnalysis {
  return { overview: makeOverview(overrideOverview), structure, details }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleSlide(deck: ReturnType<typeof buildSlideDeck>) {
  return deck.groups[0].main as TitleSlide
}

function overviewSlide(deck: ReturnType<typeof buildSlideDeck>) {
  return deck.groups[1].main as OverviewSlide
}

function summarySlide(deck: ReturnType<typeof buildSlideDeck>) {
  return deck.groups[deck.groups.length - 1].main as SummarySlide
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildSlideDeck', () => {
  describe('deck structure', () => {
    it('contains title, overview, map, and summary with no pieces', () => {
      const deck = buildSlideDeck(makePRData(), makeAnalysis())
      // title + overview + map + summary = 4 groups
      expect(deck.groups).toHaveLength(4)
      expect(deck.groups[0].main.type).toBe('title')
      expect(deck.groups[1].main.type).toBe('overview')
      expect(deck.groups[2].main.type).toBe('map')
      expect(deck.groups[deck.groups.length - 1].main.type).toBe('summary')
    })

    it('adds one group per piece', () => {
      const structure = makeStructure([makePiece('p1'), makePiece('p2'), makePiece('p3')])
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure))
      // title + overview + map + 3 pieces + summary = 7
      expect(deck.groups).toHaveLength(7)
    })

    it('sets prTitle on the deck', () => {
      const deck = buildSlideDeck(makePRData({ metadata: { title: 'My PR' } }), makeAnalysis())
      expect(deck.prTitle).toBe('My PR')
    })
  })

  describe('title slide', () => {
    it('populates all fields from metadata and overview', () => {
      const prData = makePRData({
        metadata: {
          title: 'Add feature',
          author: 'bob',
          htmlUrl: 'https://github.com/org/repo/pull/42',
          createdAt: '2024-06-15T12:00:00Z',
        },
      })
      const deck = buildSlideDeck(prData, makeAnalysis({ jiraTicket: 'PROJ-99' }))
      const slide = titleSlide(deck)
      expect(slide.prTitle).toBe('Add feature')
      expect(slide.author).toBe('bob')
      expect(slide.prUrl).toBe('https://github.com/org/repo/pull/42')
      expect(slide.jiraTicket).toBe('PROJ-99')
    })

    it('passes through a valid jiraTicket', () => {
      const deck = buildSlideDeck(makePRData(), makeAnalysis({ jiraTicket: 'ABC-123' }))
      expect(titleSlide(deck).jiraTicket).toBe('ABC-123')
    })

    it('keeps null jiraTicket as null', () => {
      const deck = buildSlideDeck(makePRData(), makeAnalysis({ jiraTicket: null }))
      expect(titleSlide(deck).jiraTicket).toBeNull()
    })

    it('normalises the string "null" returned by LLM to actual null', () => {
      // The LLM sometimes returns the string "null" instead of JSON null.
      // The builder must convert it so the template guard works correctly.
      const deck = buildSlideDeck(makePRData(), makeAnalysis({ jiraTicket: 'null' as any }))
      expect(titleSlide(deck).jiraTicket).toBeNull()
    })

    it('formats the date in human-readable form', () => {
      const deck = buildSlideDeck(
        makePRData({ metadata: { createdAt: '2024-03-07T00:00:00Z' } }),
        makeAnalysis(),
      )
      expect(titleSlide(deck).date).toMatch(/March/)
      expect(titleSlide(deck).date).toMatch(/2024/)
    })
  })

  describe('overview slide stats', () => {
    it('reflects changedFiles, additions, deletions from metadata', () => {
      const prData = makePRData({ metadata: { changedFiles: 7, additions: 120, deletions: 45 } })
      const slide = overviewSlide(buildSlideDeck(prData, makeAnalysis()))
      expect(slide.totalFiles).toBe(7)
      expect(slide.additions).toBe(120)
      expect(slide.deletions).toBe(45)
    })

    it('carries over summary, motivation, risks, c4Context, affectedAreas', () => {
      const overview = makeOverview({
        summary: 'S',
        motivation: 'M',
        risks: ['R1', 'R2'],
        c4Context: 'C4',
        affectedAreas: ['A', 'B'],
      })
      const slide = overviewSlide(buildSlideDeck(makePRData(), makeAnalysis(overview)))
      expect(slide.summary).toBe('S')
      expect(slide.motivation).toBe('M')
      expect(slide.risks).toEqual(['R1', 'R2'])
      expect(slide.c4Context).toBe('C4')
      expect(slide.affectedAreas).toEqual(['A', 'B'])
    })
  })

  describe('summary slide stats', () => {
    it('reflects changedFiles, additions, deletions from metadata', () => {
      const prData = makePRData({ metadata: { changedFiles: 4, additions: 33, deletions: 11 } })
      const slide = summarySlide(buildSlideDeck(prData, makeAnalysis()))
      expect(slide.totalFiles).toBe(4)
      expect(slide.additions).toBe(33)
      expect(slide.deletions).toBe(11)
    })

    it('mirrors the overview summary text', () => {
      const slide = summarySlide(buildSlideDeck(makePRData(), makeAnalysis({ summary: 'Done.' })))
      expect(slide.summary).toBe('Done.')
    })
  })

  describe('review order', () => {
    it('orders piece groups by reviewOrder, not pieces array order', () => {
      const p1 = makePiece('p1')
      const p2 = makePiece('p2')
      const p3 = makePiece('p3')
      // reviewOrder is reversed
      const structure = makeStructure([p1, p2, p3], ['p3', 'p1', 'p2'])
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure))
      const pieceGroups = deck.groups.slice(3, -1) as Array<{ main: PieceSummarySlide }>
      expect(pieceGroups.map((g) => g.main.name)).toEqual(['Piece p3', 'Piece p1', 'Piece p2'])
    })

    it('skips pieces referenced in reviewOrder that do not exist in pieces', () => {
      const structure = makeStructure([makePiece('p1')], ['p1', 'ghost'])
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure))
      // title + overview + map + 1 piece + summary = 5
      expect(deck.groups).toHaveLength(5)
    })
  })

  describe('per-piece vertical slides', () => {
    it('includes a UML slide when mermaidCode is present', () => {
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const details = { p1: makeDetail('p1', { mermaidCode: 'graph LR; A-->B' }) }
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure, details))
      const pieceGroup = deck.groups[3]
      expect(pieceGroup.sub.some((s) => s.type === 'uml')).toBe(true)
    })

    it('omits a UML slide when mermaidCode is null', () => {
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const details = { p1: makeDetail('p1', { mermaidCode: null }) }
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure, details))
      expect(deck.groups[3].sub.some((s) => s.type === 'uml')).toBe(false)
    })

    it('includes a signatures slide when signatures are present', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = {
        p1: makeDetail('p1', {
          signatures: [{ name: 'myFn', file: 'src/foo.ts', explanation: 'Does X' }],
        }),
      }
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure, details))
      expect(deck.groups[3].sub.some((s) => s.type === 'signatures')).toBe(true)
    })

    it('omits signatures slide when signatures array is empty', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = { p1: makeDetail('p1', { signatures: [] }) }
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure, details))
      expect(deck.groups[3].sub.some((s) => s.type === 'signatures')).toBe(false)
    })

    it('includes an issues slide when issues are present', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = {
        p1: makeDetail('p1', { issues: [{ severity: 'high', description: 'Oops' }] }),
      }
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure, details))
      expect(deck.groups[3].sub.some((s) => s.type === 'issues')).toBe(true)
    })

    it('omits issues slide when issues array is empty', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = { p1: makeDetail('p1', { issues: [] }) }
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure, details))
      expect(deck.groups[3].sub.some((s) => s.type === 'issues')).toBe(false)
    })

    it('adds code slides only for files belonging to the piece', () => {
      const fooFile = makeFile('src/foo.ts')
      const barFile = makeFile('src/bar.ts')
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const details = { p1: makeDetail('p1') }
      const deck = buildSlideDeck(
        makePRData({ files: [fooFile, barFile] }),
        makeAnalysis({}, structure, details),
      )
      const codeSlides = deck.groups[3].sub.filter((s) => s.type === 'code')
      expect(codeSlides).toHaveLength(1)
      expect((codeSlides[0] as any).filename).toBe('src/foo.ts')
    })

    it('omits code slides for files without a patch', () => {
      const noPatch = makeFile('src/foo.ts', { patch: undefined })
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const deck = buildSlideDeck(
        makePRData({ files: [noPatch] }),
        makeAnalysis({}, structure, { p1: makeDetail('p1') }),
      )
      expect(deck.groups[3].sub.filter((s) => s.type === 'code')).toHaveLength(0)
    })

    it('sets pieceIndex and totalPieces correctly on piece-summary slides', () => {
      const structure = makeStructure([makePiece('p1'), makePiece('p2')])
      const deck = buildSlideDeck(makePRData(), makeAnalysis({}, structure))
      const p1Main = deck.groups[3].main as PieceSummarySlide
      const p2Main = deck.groups[4].main as PieceSummarySlide
      expect(p1Main.pieceIndex).toBe(1)
      expect(p1Main.totalPieces).toBe(2)
      expect(p2Main.pieceIndex).toBe(2)
      expect(p2Main.totalPieces).toBe(2)
    })
  })
})
