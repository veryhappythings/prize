import { describe, it, expect } from 'bun:test'
import { buildPage } from '../src/sections/builder.js'
import type { PRData, PRMetadata, PRFile } from '../src/github/types.js'
import type { AllAnalysis, OverviewAnalysis, StructureAnalysis, DetailAnalysis } from '../src/llm/types.js'
import type { TitleSection, OverviewSection, C4ContextSection, SummarySection, PieceSummarySection } from '../src/sections/types.js'

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

function titleSection(page: ReturnType<typeof buildPage>) {
  return page.groups[0].main as TitleSection
}

function overviewSection(page: ReturnType<typeof buildPage>) {
  return page.groups[1].main as OverviewSection
}

function summarySection(page: ReturnType<typeof buildPage>) {
  return page.groups[page.groups.length - 1].main as SummarySection
}

function c4ContextSection(page: ReturnType<typeof buildPage>) {
  const group = page.groups.find((g) => g.main.type === 'c4-context')
  return group?.main as C4ContextSection | undefined
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildPage', () => {
  describe('page structure', () => {
    it('contains title, overview, c4-context, map, and summary with no pieces', () => {
      const page = buildPage(makePRData(), makeAnalysis())
      // title + overview + c4-context + map + summary = 5 groups
      expect(page.groups).toHaveLength(5)
      expect(page.groups[0].main.type).toBe('title')
      expect(page.groups[1].main.type).toBe('overview')
      expect(page.groups[2].main.type).toBe('c4-context')
      expect(page.groups[3].main.type).toBe('map')
      expect(page.groups[page.groups.length - 1].main.type).toBe('summary')
    })

    it('omits the c4-context group when overview.c4Context is blank', () => {
      const page = buildPage(makePRData(), makeAnalysis({ c4Context: '   ' }))
      expect(page.groups.some((g) => g.main.type === 'c4-context')).toBe(false)
    })

    it('adds one group per piece', () => {
      const structure = makeStructure([makePiece('p1'), makePiece('p2'), makePiece('p3')])
      const page = buildPage(makePRData(), makeAnalysis({}, structure))
      // title + overview + c4-context + map + 3 pieces + summary = 8
      expect(page.groups).toHaveLength(8)
    })

    it('sets prTitle on the page', () => {
      const page = buildPage(makePRData({ metadata: { title: 'My PR' } }), makeAnalysis())
      expect(page.prTitle).toBe('My PR')
    })

    it('sets prUrl from metadata.htmlUrl', () => {
      const page = buildPage(
        makePRData({ metadata: { htmlUrl: 'https://github.com/o/r/pull/7' } }),
        makeAnalysis(),
      )
      expect(page.prUrl).toBe('https://github.com/o/r/pull/7')
    })

    it('sets prFiles to the current filenames of all PR files', () => {
      const files = [makeFile('src/a.ts'), makeFile('src/b.ts'), makeFile('README.md')]
      const page = buildPage(makePRData({ files }), makeAnalysis())
      expect(page.prFiles).toEqual(['src/a.ts', 'src/b.ts', 'README.md'])
    })
  })

  describe('title section', () => {
    it('populates all fields from metadata and overview', () => {
      const prData = makePRData({
        metadata: {
          title: 'Add feature',
          author: 'bob',
          htmlUrl: 'https://github.com/org/repo/pull/42',
          createdAt: '2024-06-15T12:00:00Z',
        },
      })
      const page = buildPage(prData, makeAnalysis({ jiraTicket: 'PROJ-99' }))
      const section = titleSection(page)
      expect(section.prTitle).toBe('Add feature')
      expect(section.author).toBe('bob')
      expect(section.prUrl).toBe('https://github.com/org/repo/pull/42')
      expect(section.jiraTicket).toBe('PROJ-99')
    })

    it('passes through a valid jiraTicket', () => {
      const page = buildPage(makePRData(), makeAnalysis({ jiraTicket: 'ABC-123' }))
      expect(titleSection(page).jiraTicket).toBe('ABC-123')
    })

    it('keeps null jiraTicket as null', () => {
      const page = buildPage(makePRData(), makeAnalysis({ jiraTicket: null }))
      expect(titleSection(page).jiraTicket).toBeNull()
    })

    it('normalises the string "null" returned by LLM to actual null', () => {
      // The LLM sometimes returns the string "null" instead of JSON null.
      // The builder must convert it so the template guard works correctly.
      const page = buildPage(makePRData(), makeAnalysis({ jiraTicket: 'null' as any }))
      expect(titleSection(page).jiraTicket).toBeNull()
    })

    it('formats the date in human-readable form', () => {
      const page = buildPage(
        makePRData({ metadata: { createdAt: '2024-03-07T00:00:00Z' } }),
        makeAnalysis(),
      )
      expect(titleSection(page).date).toMatch(/March/)
      expect(titleSection(page).date).toMatch(/2024/)
    })
  })

  describe('overview section stats', () => {
    it('reflects changedFiles, additions, deletions from metadata', () => {
      const prData = makePRData({ metadata: { changedFiles: 7, additions: 120, deletions: 45 } })
      const section = overviewSection(buildPage(prData, makeAnalysis()))
      expect(section.totalFiles).toBe(7)
      expect(section.additions).toBe(120)
      expect(section.deletions).toBe(45)
    })

    it('carries over summary, motivation, risks, affectedAreas', () => {
      const overview = makeOverview({
        summary: 'S',
        motivation: 'M',
        risks: ['R1', 'R2'],
        affectedAreas: ['A', 'B'],
      })
      const section = overviewSection(buildPage(makePRData(), makeAnalysis(overview)))
      expect(section.summary).toBe('S')
      expect(section.motivation).toBe('M')
      expect(section.risks).toEqual(['R1', 'R2'])
      expect(section.affectedAreas).toEqual(['A', 'B'])
    })
  })

  describe('c4-context section', () => {
    it('carries the c4Context text from overview analysis', () => {
      const page = buildPage(makePRData(), makeAnalysis({ c4Context: 'System X\n\nContainer Y' }))
      expect(c4ContextSection(page)?.context).toBe('System X\n\nContainer Y')
    })
  })

  describe('summary section stats', () => {
    it('reflects changedFiles, additions, deletions from metadata', () => {
      const prData = makePRData({ metadata: { changedFiles: 4, additions: 33, deletions: 11 } })
      const section = summarySection(buildPage(prData, makeAnalysis()))
      expect(section.totalFiles).toBe(4)
      expect(section.additions).toBe(33)
      expect(section.deletions).toBe(11)
    })

    it('mirrors the overview summary text', () => {
      const section = summarySection(buildPage(makePRData(), makeAnalysis({ summary: 'Done.' })))
      expect(section.summary).toBe('Done.')
    })
  })

  describe('review order', () => {
    it('orders piece groups by reviewOrder, not pieces array order', () => {
      const p1 = makePiece('p1')
      const p2 = makePiece('p2')
      const p3 = makePiece('p3')
      // reviewOrder is reversed
      const structure = makeStructure([p1, p2, p3], ['p3', 'p1', 'p2'])
      const page = buildPage(makePRData(), makeAnalysis({}, structure))
      const pieceGroups = page.groups.slice(4, -1) as Array<{ main: PieceSummarySection }>
      expect(pieceGroups.map((g) => g.main.name)).toEqual(['Piece p3', 'Piece p1', 'Piece p2'])
    })

    it('skips pieces referenced in reviewOrder that do not exist in pieces', () => {
      const structure = makeStructure([makePiece('p1')], ['p1', 'ghost'])
      const page = buildPage(makePRData(), makeAnalysis({}, structure))
      // title + overview + c4-context + map + 1 piece + summary = 6
      expect(page.groups).toHaveLength(6)
    })
  })

  describe('per-piece sub-sections', () => {
    it('includes a UML section when mermaidCode is present', () => {
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const details = { p1: makeDetail('p1', { mermaidCode: 'graph LR; A-->B' }) }
      const page = buildPage(makePRData(), makeAnalysis({}, structure, details))
      const pieceGroup = page.groups[4]
      expect(pieceGroup.sub.some((s) => s.type === 'uml')).toBe(true)
    })

    it('omits a UML section when mermaidCode is null', () => {
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const details = { p1: makeDetail('p1', { mermaidCode: null }) }
      const page = buildPage(makePRData(), makeAnalysis({}, structure, details))
      expect(page.groups[4].sub.some((s) => s.type === 'uml')).toBe(false)
    })

    it('includes a signatures section when signatures are present', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = {
        p1: makeDetail('p1', {
          signatures: [{ name: 'myFn', file: 'src/foo.ts', explanation: 'Does X' }],
        }),
      }
      const page = buildPage(makePRData(), makeAnalysis({}, structure, details))
      expect(page.groups[4].sub.some((s) => s.type === 'signatures')).toBe(true)
    })

    it('omits signatures section when signatures array is empty', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = { p1: makeDetail('p1', { signatures: [] }) }
      const page = buildPage(makePRData(), makeAnalysis({}, structure, details))
      expect(page.groups[4].sub.some((s) => s.type === 'signatures')).toBe(false)
    })

    it('includes an issues section when issues are present', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = {
        p1: makeDetail('p1', { issues: [{ severity: 'high', description: 'Oops' }] }),
      }
      const page = buildPage(makePRData(), makeAnalysis({}, structure, details))
      expect(page.groups[4].sub.some((s) => s.type === 'issues')).toBe(true)
    })

    it('omits issues section when issues array is empty', () => {
      const structure = makeStructure([makePiece('p1')])
      const details = { p1: makeDetail('p1', { issues: [] }) }
      const page = buildPage(makePRData(), makeAnalysis({}, structure, details))
      expect(page.groups[4].sub.some((s) => s.type === 'issues')).toBe(false)
    })

    it('adds code sections only for files belonging to the piece', () => {
      const fooFile = makeFile('src/foo.ts')
      const barFile = makeFile('src/bar.ts')
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const details = { p1: makeDetail('p1') }
      const page = buildPage(
        makePRData({ files: [fooFile, barFile] }),
        makeAnalysis({}, structure, details),
      )
      const codeSections = page.groups[4].sub.filter((s) => s.type === 'code')
      expect(codeSections).toHaveLength(1)
      expect((codeSections[0] as any).filename).toBe('src/foo.ts')
    })

    it('omits code sections for files without a patch', () => {
      const noPatch = makeFile('src/foo.ts', { patch: undefined })
      const structure = makeStructure([makePiece('p1', ['src/foo.ts'])])
      const page = buildPage(
        makePRData({ files: [noPatch] }),
        makeAnalysis({}, structure, { p1: makeDetail('p1') }),
      )
      expect(page.groups[4].sub.filter((s) => s.type === 'code')).toHaveLength(0)
    })

    it('sets pieceIndex and totalPieces correctly on piece-summary sections', () => {
      const structure = makeStructure([makePiece('p1'), makePiece('p2')])
      const page = buildPage(makePRData(), makeAnalysis({}, structure))
      const p1Main = page.groups[4].main as PieceSummarySection
      const p2Main = page.groups[5].main as PieceSummarySection
      expect(p1Main.pieceIndex).toBe(1)
      expect(p1Main.totalPieces).toBe(2)
      expect(p2Main.pieceIndex).toBe(2)
      expect(p2Main.totalPieces).toBe(2)
    })
  })
})
