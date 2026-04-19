import { describe, it, expect, beforeAll } from 'bun:test'
import Handlebars from 'handlebars'
import { registerHelpers } from '../src/pipeline/generate.js'
import { fileAnchor } from '../src/util/pr-links.js'
import type { Page } from '../src/sections/types.js'

// Import the three templates under test directly
import pieceSummaryTpl from '../src/sections/templates/piece-summary.hbs' with { type: 'text' }
import signaturesTpl from '../src/sections/templates/signatures.hbs' with { type: 'text' }
import codeTpl from '../src/sections/templates/code.hbs' with { type: 'text' }

const PR_URL = 'https://github.com/owner/repo/pull/1'
const FILE = 'src/foo.ts'
const ANCHOR = fileAnchor(FILE)
const FULL_LINK = `${PR_URL}/files#${ANCHOR}`

function makePage(overrides: Partial<Pick<Page, 'prUrl' | 'prFiles'>> = {}): Page {
  return {
    prTitle: 'Test PR',
    prUrl: PR_URL,
    prFiles: [FILE],
    groups: [],
    ...overrides,
  }
}

function render(tpl: string, context: object): string {
  return Handlebars.compile(tpl)(context)
}

beforeAll(() => {
  registerHelpers(makePage())
})

describe('file_link helper', () => {
  it('wraps a filename in an anchor pointing to the PR diff', () => {
    const html = render('{{file_link name}}', { name: FILE })
    expect(html).toContain(`href="${FULL_LINK}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer"')
    expect(html).toContain('class="file-ref"')
    expect(html).toContain(FILE)
  })

  it('returns plain text when prUrl is empty', () => {
    registerHelpers(makePage({ prUrl: '' }))
    const html = render('{{{file_link name}}}', { name: FILE })
    expect(html).toBe(FILE)
    expect(html).not.toContain('<a')
    registerHelpers(makePage()) // restore
  })

  it('returns empty string for an empty filename', () => {
    expect(render('{{file_link name}}', { name: '' })).toBe('')
  })

  it('HTML-escapes the filename in the link text', () => {
    const weird = '<weird>.ts'
    registerHelpers(makePage({ prFiles: [weird] }))
    const html = render('{{{file_link name}}}', { name: weird })
    expect(html).not.toContain('<weird>')
    expect(html).toContain('&lt;weird&gt;.ts')
    registerHelpers(makePage())
  })
})

describe('piece-summary.hbs', () => {
  it('wraps each file in the list with a link', () => {
    const html = render(pieceSummaryTpl, {
      section: {
        pieceIndex: 1,
        totalPieces: 1,
        name: 'Auth changes',
        description: 'Changes to auth',
        files: [FILE],
      },
    })
    expect(html).toContain(`<li><a class="file-ref" href="${FULL_LINK}"`)
    expect(html).toContain(`>${FILE}</a></li>`)
  })
})

describe('signatures.hbs', () => {
  it('wraps the file column with a link', () => {
    const html = render(signaturesTpl, {
      section: {
        pieceName: 'Auth',
        signatures: [{ name: 'doAuth', file: FILE, explanation: 'Does auth' }],
      },
    })
    expect(html).toContain(`<td class="file-path"><a class="file-ref" href="${FULL_LINK}"`)
    expect(html).toContain(`>${FILE}</a></td>`)
  })
})

describe('code.hbs', () => {
  it('wraps the filename heading with a link, leaving the status span intact', () => {
    const html = render(codeTpl, {
      section: {
        pieceName: 'Auth',
        filename: FILE,
        patch: '@@ -1 +1 @@',
        status: 'modified',
      },
    })
    expect(html).toContain(`<a class="file-ref" href="${FULL_LINK}"`)
    expect(html).toContain(`>${FILE}</a>`)
    expect(html).toContain('<span class="status status-modified">modified</span>')
  })
})

describe('md helper — prose autolinking', () => {
  it('links a backticked PR filename to its diff anchor', () => {
    const html = render('{{{md text}}}', { text: `see \`${FILE}\` for details` })
    expect(html).toContain(`<a class="file-ref" href="${FULL_LINK}"`)
    expect(html).toContain(`<code>${FILE}</code>`)
  })

  it('does not link a backticked path that is not in the PR', () => {
    const html = render('{{{md text}}}', { text: '`src/missing.ts` was not changed' })
    expect(html).not.toContain('<a')
    expect(html).toContain('<code>src/missing.ts</code>')
  })

  it('links a path with a trailing line number (strips :N before lookup)', () => {
    const html = render('{{{md text}}}', { text: `see \`${FILE}:42\`` })
    expect(html).toContain(`href="${FULL_LINK}"`)
    // :42 is still shown in the <code> text
    expect(html).toContain(`<code>${FILE}:42</code>`)
  })

  it('links a path with a trailing anchor reference (strips #L before lookup)', () => {
    const html = render('{{{md text}}}', { text: `see \`${FILE}#L10\`` })
    expect(html).toContain(`href="${FULL_LINK}"`)
    expect(html).toContain(`<code>${FILE}#L10</code>`)
  })

  it('keeps non-path backtick content as plain <code>', () => {
    const html = render('{{{md text}}}', { text: '`const x = 1`' })
    expect(html).toBe('<code>const x = 1</code>')
    expect(html).not.toContain('<a')
  })

  it('renders no links when prUrl is empty', () => {
    registerHelpers(makePage({ prUrl: '' }))
    const html = render('{{{md text}}}', { text: `\`${FILE}\`` })
    expect(html).not.toContain('<a')
    expect(html).toContain(`<code>${FILE}</code>`)
    registerHelpers(makePage())
  })
})
