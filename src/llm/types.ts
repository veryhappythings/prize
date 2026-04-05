export interface OverviewAnalysis {
  summary: string
  motivation: string
  risks: string[]
  jiraTicket: string | null
  c4Context: string
  affectedAreas: string[]
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
