import Handlebars from 'handlebars'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '../sections/types.js'

// Templates — embedded at build time
import pageTpl from '../sections/templates/page.hbs' with { type: 'text' }
import titleTpl from '../sections/templates/title.hbs' with { type: 'text' }
import overviewTpl from '../sections/templates/overview.hbs' with { type: 'text' }
import c4ContextTpl from '../sections/templates/c4-context.hbs' with { type: 'text' }
import mapTpl from '../sections/templates/map.hbs' with { type: 'text' }
import pieceSummaryTpl from '../sections/templates/piece-summary.hbs' with { type: 'text' }
import umlTpl from '../sections/templates/uml.hbs' with { type: 'text' }
import signaturesTpl from '../sections/templates/signatures.hbs' with { type: 'text' }
import walkthroughTpl from '../sections/templates/walkthrough.hbs' with { type: 'text' }
import codeTpl from '../sections/templates/code.hbs' with { type: 'text' }
import issuesTpl from '../sections/templates/issues.hbs' with { type: 'text' }
import summaryTpl from '../sections/templates/summary.hbs' with { type: 'text' }

// Static assets — embedded at build time
import monokaiCss from '../../static/monokai.css' with { type: 'text' }
import styleCss from '../../static/style.css' with { type: 'text' }
import highlightJs from '../../static/highlight.min.js' with { type: 'text' }
import mermaidJs from '../../static/mermaid.min.js' with { type: 'text' }

const TEMPLATES: Record<string, string> = {
  page: pageTpl,
  title: titleTpl,
  overview: overviewTpl,
  'c4-context': c4ContextTpl,
  map: mapTpl,
  'piece-summary': pieceSummaryTpl,
  uml: umlTpl,
  signatures: signaturesTpl,
  walkthrough: walkthroughTpl,
  code: codeTpl,
  issues: issuesTpl,
  summary: summaryTpl,
}

const STATIC_ASSETS: Record<string, string> = {
  'monokai.css': monokaiCss,
  'style.css': styleCss,
  'highlight.min.js': highlightJs,
  'mermaid.min.js': mermaidJs,
}

function loadTemplate(name: string): string {
  const tpl = TEMPLATES[name]
  if (!tpl) throw new Error(`Template not found: ${name}.hbs`)
  return tpl
}

function registerPartials() {
  const sectionTypes = [
    'title',
    'overview',
    'c4-context',
    'map',
    'piece-summary',
    'uml',
    'signatures',
    'walkthrough',
    'code',
    'issues',
    'summary',
  ]
  for (const type of sectionTypes) {
    Handlebars.registerPartial(type, loadTemplate(type))
  }
}

function registerHelpers() {
  // Allows {{> (section_partial type) section=this}} dynamic partial lookup
  Handlebars.registerHelper('section_partial', (type: string) => type)

  // Renders markdown (bold, italic, backtick code) as HTML. Input is
  // HTML-escaped first. Single-paragraph input returns inline HTML with no
  // wrapper (safe inside <span>, <td>, etc.); multi-paragraph input (blank
  // lines) returns one <p> block per paragraph. Single newlines become <br>.
  Handlebars.registerHelper('md', (text: string) => {
    if (!text) return ''
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const inline = (s: string) =>
      s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
    const paragraphs = String(text)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => inline(escape(p)).replace(/\n/g, '<br>'))
    const html = paragraphs.length <= 1
      ? paragraphs[0] ?? ''
      : paragraphs.map((p) => `<p>${p}</p>`).join('')
    return new Handlebars.SafeString(html)
  })

  // Returns true if the section type is 'map' (used to skip map group in rendering)
  Handlebars.registerHelper('is_map', (type: string) => type === 'map')

  // Extracts a human-readable sidebar label from a main section
  Handlebars.registerHelper('section_label', (section: Record<string, unknown>) => {
    switch (section.type) {
      case 'title': return section.prTitle as string
      case 'overview': return 'Overview'
      case 'c4-context': return 'C4 Context'
      case 'piece-summary': return section.name as string
      case 'summary': return 'Summary'
      default: return String(section.type)
    }
  })
}

export async function generateSite(page: Page, outputDir: string): Promise<string> {
  mkdirSync(outputDir, { recursive: true })

  registerPartials()
  registerHelpers()

  // Render main HTML
  const pageTemplate = Handlebars.compile(loadTemplate('page'))
  const html = pageTemplate(page)
  const indexPath = join(outputDir, 'index.html')
  writeFileSync(indexPath, html, 'utf-8')

  // Write embedded static assets
  for (const [name, content] of Object.entries(STATIC_ASSETS)) {
    writeFileSync(join(outputDir, name), content, 'utf-8')
  }

  return indexPath
}
