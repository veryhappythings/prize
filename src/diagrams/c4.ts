import ELK from 'elkjs/lib/elk-api.js'
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js'
import type {
  C4Boundary,
  C4Diagram,
  C4Element,
  C4ElementKind,
  C4Relationship,
} from '../llm/types.js'

const KINDS: C4ElementKind[] = [
  'person',
  'system',
  'external-system',
  'container',
  'database',
  'component',
]

const MAX_ELEMENTS = 20
const MAX_BOUNDARY_DEPTH = 4

// ─── Normalisation ────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const optStr = (v: unknown): string | null => {
  const s = str(v)
  return s && s !== 'null' ? s : null
}

/** Cleans up an LLM-produced diagram so it can always be laid out. Unknown
 *  references are dropped rather than failing. Returns null if nothing
 *  drawable is left. */
export function normalizeC4(raw: unknown): C4Diagram | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []

  const boundaries = new Map<string, C4Boundary>()
  for (const b of arr(input.boundaries)) {
    const id = str(b.id)
    if (!id || boundaries.has(id)) continue
    boundaries.set(id, { id, name: str(b.name) || id, parent: optStr(b.parent) })
  }
  for (const b of boundaries.values()) {
    if (b.parent && !boundaries.has(b.parent)) b.parent = null
  }
  // Break cycles and cap nesting depth
  for (const b of boundaries.values()) {
    let cur: C4Boundary | undefined = b
    for (let depth = 0; cur?.parent; depth++) {
      if (depth >= MAX_BOUNDARY_DEPTH || cur.parent === b.id) {
        b.parent = null
        break
      }
      cur = boundaries.get(cur.parent)
    }
  }

  const elements = new Map<string, C4Element>()
  for (const e of arr(input.elements)) {
    const id = str(e.id)
    if (!id || elements.has(id) || boundaries.has(id)) continue
    if (elements.size >= MAX_ELEMENTS) break
    const kind = KINDS.includes(e.kind as C4ElementKind) ? (e.kind as C4ElementKind) : 'system'
    const boundary = optStr(e.boundary)
    elements.set(id, {
      id,
      name: str(e.name) || id,
      kind,
      technology: optStr(e.technology),
      description: str(e.description),
      boundary: boundary && boundaries.has(boundary) ? boundary : null,
      changed: e.changed === true,
    })
  }
  if (elements.size === 0) return null

  // Keep only boundaries that contain an element somewhere below them
  const used = new Set<string>()
  for (const e of elements.values()) {
    for (let b = e.boundary; b && !used.has(b); b = boundaries.get(b)?.parent ?? null) {
      used.add(b)
    }
  }

  const seen = new Set<string>()
  const relationships: C4Relationship[] = []
  for (const r of arr(input.relationships)) {
    const from = str(r.from)
    const to = str(r.to)
    if (!elements.has(from) || !elements.has(to) || from === to) continue
    const key = `${from}\0${to}`
    if (seen.has(key)) continue
    seen.add(key)
    relationships.push({
      from,
      to,
      label: str(r.label),
      technology: optStr(r.technology),
      changed: r.changed === true,
    })
  }

  return {
    elements: [...elements.values()],
    boundaries: [...boundaries.values()].filter((b) => used.has(b.id)),
    relationships,
  }
}

// ─── Text measurement ─────────────────────────────────────────────────────────

// No DOM at generate time, so estimate widths from an average glyph width.
const CHAR_WIDTH = 0.56

function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * CHAR_WIDTH)))
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= maxChars) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const last = lines[maxLines - 1]!
    lines.length = maxLines
    lines[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + '…'
  }
  return lines
}

const textWidth = (s: string, fontSize: number) => s.length * fontSize * CHAR_WIDTH

// ─── Element geometry ─────────────────────────────────────────────────────────

const NODE_WIDTH = 220
const NODE_PAD = 12
const NAME_SIZE = 14
const META_SIZE = 11
const DESC_SIZE = 12
const LINE = 1.3
const PERSON_HEAD = 34 // vertical space taken by the head above the body
const DB_CAP = 10 // height of the cylinder's top ellipse

interface NodeLayout {
  el: C4Element
  name: string[]
  meta: string
  desc: string[]
  bodyTop: number
  width: number
  height: number
}

const KIND_LABEL: Record<C4ElementKind, string> = {
  person: 'Person',
  system: 'Software System',
  'external-system': 'External System',
  container: 'Container',
  database: 'Database',
  component: 'Component',
}

function measureElement(el: C4Element): NodeLayout {
  const inner = NODE_WIDTH - NODE_PAD * 2
  const name = wrap(el.name, NAME_SIZE, inner, 2)
  const meta = el.technology ? `[${KIND_LABEL[el.kind]}: ${el.technology}]` : `[${KIND_LABEL[el.kind]}]`
  const desc = el.description ? wrap(el.description, DESC_SIZE, inner, 4) : []
  const bodyTop = el.kind === 'person' ? PERSON_HEAD : el.kind === 'database' ? DB_CAP : 0
  const contentHeight =
    name.length * NAME_SIZE * LINE +
    4 +
    META_SIZE * LINE +
    (desc.length ? 6 + desc.length * DESC_SIZE * LINE : 0)
  return {
    el,
    name,
    meta: wrap(meta, META_SIZE, inner, 1)[0] ?? meta,
    desc,
    bodyTop,
    width: NODE_WIDTH,
    height: Math.ceil(bodyTop + NODE_PAD * 2 + contentHeight + (el.kind === 'database' ? DB_CAP : 0)),
  }
}

const EDGE_SIZE = 11

function edgeLabelLines(r: C4Relationship): string[] {
  const lines = r.label ? wrap(r.label, EDGE_SIZE, 160, 3) : []
  if (r.technology) lines.push(`[${r.technology}]`)
  return lines
}

// ─── Layout ───────────────────────────────────────────────────────────────────

type ElkCtor = new (opts: { workerFactory: (url?: string) => unknown }) => {
  layout(graph: ElkNode): Promise<ElkNode>
}

let elkInstance: InstanceType<ElkCtor> | null = null

function getElk() {
  if (elkInstance) return elkInstance
  // elk-worker.min.js registers itself as a real web worker whenever `self`
  // exists, which it does under Bun. Hide `self` while loading so it exports
  // FakeWorker instead, which runs layouts in-process.
  const g = globalThis as { self?: unknown }
  const savedSelf = g.self
  delete g.self
  let FakeWorker: new (url?: string) => unknown
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    FakeWorker = require('elkjs/lib/elk-worker.min.js').Worker
  } finally {
    g.self = savedSelf
  }
  elkInstance = new (ELK as unknown as ElkCtor)({ workerFactory: (url) => new FakeWorker(url) })
  return elkInstance
}

const BOUNDARY_LABEL = 30
const BOUNDARY_SIZE = 13

async function layout(diagram: C4Diagram, nodes: Map<string, NodeLayout>) {
  const elkNodes = new Map<string, ElkNode>()
  for (const b of diagram.boundaries) {
    elkNodes.set(b.id, {
      id: b.id,
      children: [],
      layoutOptions: {
        'elk.padding': `[top=${BOUNDARY_LABEL + 12},left=20,bottom=20,right=20]`,
      },
    })
  }
  for (const n of nodes.values()) {
    elkNodes.set(n.el.id, { id: n.el.id, width: n.width, height: n.height })
  }

  const root: ElkNode = {
    id: '__root',
    children: [],
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.spacing.nodeNode': '50',
      'elk.spacing.edgeNode': '25',
      'elk.spacing.edgeEdge': '20',
      'elk.spacing.edgeLabel': '6',
      'elk.edgeLabels.placement': 'CENTER',
      'elk.padding': '[top=10,left=10,bottom=10,right=10]',
    },
  }
  const parentOf = (id: string, parent: string | null) =>
    (parent ? elkNodes.get(parent)! : root).children!.push(elkNodes.get(id)!)
  for (const b of diagram.boundaries) parentOf(b.id, b.parent)
  for (const e of diagram.elements) parentOf(e.id, e.boundary)

  root.edges = diagram.relationships.map((r, i): ElkExtendedEdge => {
    const lines = edgeLabelLines(r)
    return {
      id: `e${i}`,
      sources: [r.from],
      targets: [r.to],
      labels: lines.length
        ? [{
          text: lines.join('\n'),
          width: Math.ceil(Math.max(...lines.map((l) => textWidth(l, EDGE_SIZE)))) + 8,
          height: Math.ceil(lines.length * EDGE_SIZE * LINE) + 4,
        }]
        : [],
    }
  })

  return getElk().layout(root)
}

// ─── SVG rendering ────────────────────────────────────────────────────────────

const COLORS: Record<C4ElementKind, { fill: string; stroke: string; text: string }> = {
  person: { fill: '#08427b', stroke: '#052e56', text: '#ffffff' },
  system: { fill: '#1168bd', stroke: '#0b4884', text: '#ffffff' },
  'external-system': { fill: '#6b6b7b', stroke: '#4d4d5a', text: '#ffffff' },
  container: { fill: '#438dd5', stroke: '#2e6295', text: '#ffffff' },
  database: { fill: '#438dd5', stroke: '#2e6295', text: '#ffffff' },
  component: { fill: '#85bbf0', stroke: '#5d82a8', text: '#0b2540' },
}
const CHANGED = '#f0c040'
const EDGE = '#9a9ab0'
const BOUNDARY = '#8a8aa0'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const r1 = (n: number) => Math.round(n * 10) / 10

function textLines(
  lines: string[],
  x: number,
  y: number,
  size: number,
  attrs: string,
): { svg: string; y: number } {
  let svg = ''
  for (const line of lines) {
    y += size
    svg += `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" ${attrs}>${esc(line)}</text>`
    y += size * (LINE - 1)
  }
  return { svg, y }
}

function renderElement(n: NodeLayout, x: number, y: number): string {
  const c = COLORS[n.el.kind]
  const stroke = n.el.changed ? CHANGED : c.stroke
  const sw = n.el.changed ? 3 : 1.5
  const { width: w, height: h } = n
  const cx = x + w / 2
  let shape: string
  switch (n.el.kind) {
    case 'person': {
      const r = 20
      shape =
        `<rect x="${r1(x)}" y="${r1(y + PERSON_HEAD - 8)}" width="${w}" height="${r1(h - PERSON_HEAD + 8)}" rx="22" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
        `<circle cx="${r1(cx)}" cy="${r1(y + r)}" r="${r}" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}"/>`
      break
    }
    case 'database': {
      const ry = DB_CAP
      const top = y + ry
      const bot = y + h - ry
      shape =
        `<path d="M${r1(x)},${r1(top)} A${w / 2},${ry} 0 0 1 ${r1(x + w)},${r1(top)} V${r1(bot)} A${w / 2},${ry} 0 0 1 ${r1(x)},${r1(bot)} Z" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
        `<path d="M${r1(x)},${r1(top)} A${w / 2},${ry} 0 0 0 ${r1(x + w)},${r1(top)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`
      break
    }
    default: {
      const rx = n.el.kind === 'component' ? 4 : 8
      shape = `<rect x="${r1(x)}" y="${r1(y)}" width="${w}" height="${h}" rx="${rx}" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}"/>`
    }
  }

  const fill = `fill="${c.text}" text-anchor="middle"`
  let ty = y + n.bodyTop + NODE_PAD
  const name = textLines(n.name, cx, ty, NAME_SIZE, `${fill} font-weight="600"`)
  ty = name.y + 4
  const meta = textLines([n.meta], cx, ty, META_SIZE, `${fill} opacity="0.8"`)
  ty = meta.y + 6
  const desc = textLines(n.desc, cx, ty, DESC_SIZE, `${fill} opacity="0.95"`)

  const title = `<title>${esc(`${n.el.name} — ${n.el.description}`)}</title>`
  return `<g class="c4-el${n.el.changed ? ' c4-changed' : ''}">${title}${shape}${name.svg}${meta.svg}${desc.svg}</g>`
}

function pathFromSection(
  s: { startPoint: { x: number; y: number }; endPoint: { x: number; y: number }; bendPoints?: { x: number; y: number }[] },
  ox: number,
  oy: number,
): string {
  const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]
  return pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x + ox)},${r1(p.y + oy)}`).join(' ')
}

/** Lays out and renders a C4 diagram as a standalone SVG string. */
export async function renderC4Svg(diagram: C4Diagram): Promise<string> {
  const nodes = new Map(diagram.elements.map((e) => [e.id, measureElement(e)]))
  const boundaryById = new Map(diagram.boundaries.map((b) => [b.id, b]))
  const graph = await layout(diagram, nodes)

  // ELK positions are relative to the parent node; resolve absolute offsets.
  const abs = new Map<string, { x: number; y: number }>([['__root', { x: 0, y: 0 }]])
  const boundarySvg: string[] = []
  const boundaryLabelSvg: string[] = []
  const elementSvg: string[] = []
  const walk = (node: ElkNode, ox: number, oy: number, depth: number) => {
    for (const child of node.children ?? []) {
      const x = ox + (child.x ?? 0)
      const y = oy + (child.y ?? 0)
      abs.set(child.id, { x, y })
      const b = boundaryById.get(child.id)
      if (b) {
        const w = child.width ?? 0
        const h = child.height ?? 0
        boundarySvg.push(
          `<rect class="c4-boundary" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="6" fill="${depth ? 'none' : 'rgba(255,255,255,0.02)'}" stroke="${BOUNDARY}" stroke-width="1.2" stroke-dasharray="7 5"/>`,
        )
        // Titles go above edges, with a backing so crossing edges don't obscure them
        const name = wrap(b.name, BOUNDARY_SIZE, w - 24, 1)[0] ?? b.name
        boundaryLabelSvg.push(
          `<rect x="${r1(x + 8)}" y="${r1(y + 6)}" width="${r1(textWidth(name, BOUNDARY_SIZE) + 8)}" height="${BOUNDARY_SIZE + 8}" rx="3" fill="#16162a"/>` +
          `<text x="${r1(x + 12)}" y="${r1(y + 6 + BOUNDARY_SIZE + 1)}" font-size="${BOUNDARY_SIZE}" font-weight="600" fill="${BOUNDARY}">${esc(name)}</text>`,
        )
        walk(child, x, y, depth + 1)
      } else {
        const n = nodes.get(child.id)
        if (n) elementSvg.push(renderElement(n, x, y))
      }
    }
  }
  walk(graph, 0, 0, 0)

  const edgeSvg: string[] = []
  const labelSvg: string[] = []
  const edges = (graph.edges ?? []) as (ElkExtendedEdge & { container?: string })[]
  for (const edge of edges) {
    const rel = diagram.relationships[Number(edge.id.slice(1))]
    if (!rel || !edge.sections?.length) continue
    const o = abs.get(edge.container ?? '__root') ?? { x: 0, y: 0 }
    const color = rel.changed ? CHANGED : EDGE
    const marker = rel.changed ? 'c4-arrow-changed' : 'c4-arrow'
    for (const s of edge.sections) {
      edgeSvg.push(
        `<path d="${pathFromSection(s, o.x, o.y)}" fill="none" stroke="${color}" stroke-width="${rel.changed ? 2 : 1.3}"${rel.changed ? '' : ' stroke-dasharray="5 4"'} marker-end="url(#${marker})"/>`,
      )
    }
    for (const label of edge.labels ?? []) {
      const lx = o.x + (label.x ?? 0)
      const ly = o.y + (label.y ?? 0)
      const lines = (label.text ?? '').split('\n')
      const cx = lx + (label.width ?? 0) / 2
      const bg = `<rect x="${r1(lx)}" y="${r1(ly)}" width="${r1(label.width ?? 0)}" height="${r1(label.height ?? 0)}" rx="3" fill="#16162a" opacity="0.9"/>`
      const txt = textLines(lines, cx, ly + 1, EDGE_SIZE, `fill="${rel.changed ? CHANGED : '#c8c8d8'}" text-anchor="middle"`)
      labelSvg.push(bg + txt.svg)
    }
  }

  const width = Math.ceil(graph.width ?? 0)
  const height = Math.ceil(graph.height ?? 0)
  const arrow = (id: string, color: string) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="c4-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="C4 diagram">` +
    `<defs>${arrow('c4-arrow', EDGE)}${arrow('c4-arrow-changed', CHANGED)}</defs>` +
    boundarySvg.join('') +
    edgeSvg.join('') +
    boundaryLabelSvg.join('') +
    elementSvg.join('') +
    labelSvg.join('') +
    `</svg>`
  )
}
