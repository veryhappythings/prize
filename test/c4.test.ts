import { describe, it, expect } from 'bun:test'
import { normalizeC4, renderC4Svg } from '../src/diagrams/c4.js'

const el = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id.toUpperCase(),
  kind: 'container',
  technology: 'TypeScript',
  description: `The ${id} thing`,
  boundary: null,
  changed: false,
  ...extra,
})

describe('normalizeC4', () => {
  it('returns null for missing or empty input', () => {
    expect(normalizeC4(null)).toBeNull()
    expect(normalizeC4('nope')).toBeNull()
    expect(normalizeC4({ elements: [], boundaries: [], relationships: [] })).toBeNull()
  })

  it('drops relationships to unknown ids, self-loops and duplicates', () => {
    const d = normalizeC4({
      elements: [el('a'), el('b')],
      boundaries: [],
      relationships: [
        { from: 'a', to: 'b', label: 'uses', technology: null, changed: true },
        { from: 'a', to: 'b', label: 'dupe', technology: null, changed: false },
        { from: 'a', to: 'a', label: 'self', technology: null, changed: false },
        { from: 'a', to: 'ghost', label: 'unknown', technology: null, changed: false },
      ],
    })!
    expect(d.relationships).toEqual([{ from: 'a', to: 'b', label: 'uses', technology: null, changed: true }])
  })

  it('clears unknown boundary refs and drops empty boundaries', () => {
    const d = normalizeC4({
      elements: [el('a', { boundary: 'sys' }), el('b', { boundary: 'missing' })],
      boundaries: [
        { id: 'sys', name: 'System', parent: null },
        { id: 'empty', name: 'Empty', parent: null },
      ],
      relationships: [],
    })!
    expect(d.elements.map((e) => e.boundary)).toEqual(['sys', null])
    expect(d.boundaries.map((b) => b.id)).toEqual(['sys'])
  })

  it('breaks boundary cycles', () => {
    const d = normalizeC4({
      elements: [el('a', { boundary: 'x' })],
      boundaries: [
        { id: 'x', name: 'X', parent: 'y' },
        { id: 'y', name: 'Y', parent: 'x' },
      ],
      relationships: [],
    })!
    // Walking parents from any boundary must terminate
    const byId = new Map(d.boundaries.map((b) => [b.id, b]))
    for (const b of d.boundaries) {
      let cur: typeof b | undefined = b
      for (let i = 0; cur?.parent; i++) {
        expect(i).toBeLessThan(10)
        cur = byId.get(cur.parent)
      }
    }
  })

  it('defaults unknown kinds, "null" strings and non-boolean changed flags', () => {
    const d = normalizeC4({
      elements: [el('a', { kind: 'spaceship', technology: 'null', changed: 'yes' })],
      boundaries: [],
      relationships: [],
    })!
    expect(d.elements[0]).toMatchObject({ kind: 'system', technology: null, changed: false })
  })
})

describe('renderC4Svg', () => {
  it('lays out nested boundaries and renders elements, edges and labels', async () => {
    const d = normalizeC4({
      elements: [
        el('user', { kind: 'person', technology: null }),
        el('api', { boundary: 'sys', changed: true }),
        el('db', { kind: 'database', boundary: 'sys' }),
        el('handler', { kind: 'component', boundary: 'api_b' }),
      ],
      boundaries: [
        { id: 'sys', name: 'Shop <System>', parent: null },
        { id: 'api_b', name: 'API internals', parent: 'sys' },
      ],
      relationships: [
        { from: 'user', to: 'api', label: 'Places orders', technology: 'HTTPS', changed: true },
        { from: 'api', to: 'db', label: 'Reads & writes', technology: 'SQL', changed: false },
        { from: 'handler', to: 'db', label: 'Queries', technology: null, changed: false },
      ],
    })!
    const svg = await renderC4Svg(d)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/)
    expect(svg).not.toContain('NaN')
    expect(svg).toContain('Shop &lt;System&gt;')
    expect(svg).toContain('Reads &amp; writes')
    expect(svg).toContain('[HTTPS]')
    expect(svg.match(/class="c4-el/g)).toHaveLength(4)
    expect(svg.match(/c4-changed/g)).toHaveLength(1)
    expect(svg.match(/marker-end=/g)).toHaveLength(3)
  })
})
