export type SlideType =
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

export interface TitleSlide {
  type: 'title'
  prTitle: string
  prUrl: string
  author: string
  repo: string
  date: string
  jiraTicket: string | null
}

export interface OverviewSlide {
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

export interface MapSlide {
  type: 'map'
  pieces: Array<{ name: string; description: string }>
}

export interface PieceSummarySlide {
  type: 'piece-summary'
  pieceIndex: number
  totalPieces: number
  name: string
  description: string
  files: string[]
}

export interface UmlSlide {
  type: 'uml'
  pieceName: string
  mermaidCode: string
}

export interface SignaturesSlide {
  type: 'signatures'
  pieceName: string
  signatures: Array<{ name: string; file: string; explanation: string }>
}

export interface WalkthroughSlide {
  type: 'walkthrough'
  pieceName: string
  walkthrough: string
}

export interface CodeSlide {
  type: 'code'
  pieceName: string
  filename: string
  patch: string
  status: string
}

export interface IssuesSlide {
  type: 'issues'
  pieceName: string
  issues: Array<{ severity: 'low' | 'medium' | 'high'; description: string }>
}

export interface SummarySlide {
  type: 'summary'
  summary: string
  risks: string[]
  totalFiles: number
  additions: number
  deletions: number
}

export type Slide =
  | TitleSlide
  | OverviewSlide
  | MapSlide
  | PieceSummarySlide
  | UmlSlide
  | SignaturesSlide
  | WalkthroughSlide
  | CodeSlide
  | IssuesSlide
  | SummarySlide

/** A group represents a horizontal position in the deck.
 *  Within a group, slides stack vertically. */
export interface SlideGroup {
  /** The "top" slide shown when navigating horizontally */
  main: Slide
  /** Vertical slides accessed by pressing Down */
  sub: Slide[]
}

export interface SlideDeck {
  prTitle: string
  groups: SlideGroup[]
}
