import Handlebars from 'handlebars'
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '../sections/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Find the project root by walking up until we find package.json.
 * Works in both dev mode (tsx src/...) and bundled mode (dist/cli.js).
 */
function findProjectRoot(): string {
  let dir = __dirname
  while (true) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error('Could not find project root (no package.json found)')
    dir = parent
  }
}

const projectRoot = findProjectRoot()

function loadTemplate(name: string): string {
  return readFileSync(join(projectRoot, 'src/sections/templates', `${name}.hbs`), 'utf-8')
}

function registerPartials() {
  const sectionTypes = [
    'title',
    'overview',
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

  // Renders inline markdown (bold, italic, backtick code) as HTML.
  // Input is HTML-escaped first to prevent injection.
  Handlebars.registerHelper('md', (text: string) => {
    if (!text) return ''
    const escaped = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const html = escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
    return new Handlebars.SafeString(html)
  })

  // Returns true if the section type is 'map' (used to skip map group in rendering)
  Handlebars.registerHelper('is_map', (type: string) => type === 'map')

  // Extracts a human-readable sidebar label from a main section
  Handlebars.registerHelper('section_label', (section: Record<string, unknown>) => {
    switch (section.type) {
      case 'title': return section.prTitle as string
      case 'overview': return 'Overview'
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

  // Copy static assets (mermaid, style.css, etc.)
  const staticSrc = join(projectRoot, 'static')
  if (existsSync(staticSrc)) {
    cpSync(staticSrc, outputDir, { recursive: true })
  }

  return indexPath
}
