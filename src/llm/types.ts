export interface OverviewAnalysis {
  summary: string
  motivation: string
  risks: string[]
  jiraTicket: string | null
  c4Context: string
  /** Absent in overviews cached before diagrams were added */
  c4Diagram?: C4Diagram | null
  affectedAreas: string[]
}

export type C4ElementKind =
  | 'person'
  | 'system'
  | 'external-system'
  | 'container'
  | 'database'
  | 'component'

export interface C4Element {
  id: string
  name: string
  kind: C4ElementKind
  technology: string | null
  description: string
  /** id of the enclosing boundary, or null for top level */
  boundary: string | null
  /** true if this PR changes the element */
  changed: boolean
}

export interface C4Boundary {
  id: string
  name: string
  /** id of the enclosing boundary, or null for top level */
  parent: string | null
}

export interface C4Relationship {
  from: string
  to: string
  label: string
  technology: string | null
  /** true if this PR adds or changes the interaction */
  changed: boolean
}

export interface C4Diagram {
  elements: C4Element[]
  boundaries: C4Boundary[]
  relationships: C4Relationship[]
}

export interface Piece {
  id: string
  name: string
  description: string
  files: string[]
  suggestUml: boolean
  umlType: string | null
  umlDescription: string | null
}

export interface StructureAnalysis {
  pieces: Piece[]
  reviewOrder: string[]
}

export interface Signature {
  name: string
  file: string
  explanation: string
}

export interface Issue {
  severity: 'low' | 'medium' | 'high'
  description: string
}

export interface DetailAnalysis {
  pieceId: string
  pieceSummary: string
  signatures: Signature[]
  walkthrough: string
  issues: Issue[]
  mermaidCode: string | null
}

export interface AllAnalysis {
  overview: OverviewAnalysis
  structure: StructureAnalysis
  details: Record<string, DetailAnalysis>
}
