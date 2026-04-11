export type SectionType =
  | 'title'
  | 'overview'
  | 'map'
  | 'piece-summary'
  | 'uml'
  | 'signatures'
  | 'walkthrough'
  | 'code'
  | 'issues'
  | 'summary'

export interface TitleSection {
  type: 'title'
  prTitle: string
  prUrl: string
  author: string
  repo: string
  date: string
  jiraTicket: string | null
}

export interface OverviewSection {
  type: 'overview'
  summary: string
  motivation: string
  c4Context: string
  affectedAreas: string[]
  risks: string[]
  totalFiles: number
  additions: number
  deletions: number
}

export interface MapSection {
  type: 'map'
  pieces: Array<{ name: string; description: string }>
}

export interface PieceSummarySection {
  type: 'piece-summary'
  pieceIndex: number
  totalPieces: number
  name: string
  description: string
  files: string[]
}

export interface UmlSection {
  type: 'uml'
  pieceName: string
  mermaidCode: string
}

export interface SignaturesSection {
  type: 'signatures'
  pieceName: string
  signatures: Array<{ name: string; file: string; explanation: string }>
}

export interface WalkthroughSection {
  type: 'walkthrough'
  pieceName: string
  walkthrough: string
}

export interface CodeSection {
  type: 'code'
  pieceName: string
  filename: string
  patch: string
  status: string
}

export interface IssuesSection {
  type: 'issues'
  pieceName: string
  issues: Array<{ severity: 'low' | 'medium' | 'high'; description: string }>
}

export interface SummarySection {
  type: 'summary'
  summary: string
  risks: string[]
  totalFiles: number
  additions: number
  deletions: number
}

export type Section =
  | TitleSection
  | OverviewSection
  | MapSection
  | PieceSummarySection
  | UmlSection
  | SignaturesSection
  | WalkthroughSection
  | CodeSection
  | IssuesSection
  | SummarySection

/** A group represents one entry in the sidebar.
 *  Within a group, sub-sections stack below the main section. */
export interface SectionGroup {
  /** The primary section shown at the top of the group */
  main: Section
  /** Sub-sections rendered below the main section */
  sub: Section[]
}

export interface Page {
  prTitle: string
  groups: SectionGroup[]
}
