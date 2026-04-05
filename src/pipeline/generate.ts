import Handlebars from 'handlebars'
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SlideDeck } from '../slides/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadTemplate(name: string): string {
  return readFileSync(join(__dirname, '../slides/templates', `${name}.hbs`), 'utf-8')
}

function registerPartials() {
  const slideTypes = [
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
  for (const type of slideTypes) {
    Handlebars.registerPartial(type, loadTemplate(type))
  }
}

function registerHelpers() {
  // Allows {{> (slide_partial type) slide=this}} dynamic partial lookup
  Handlebars.registerHelper('slide_partial', (type: string) => type)
}

export async function generateSite(deck: SlideDeck, outputDir: string): Promise<string> {
  mkdirSync(outputDir, { recursive: true })

  registerPartials()
  registerHelpers()

  // Render main HTML
  const deckTemplate = Handlebars.compile(loadTemplate('deck'))
  const html = deckTemplate(deck)
  const indexPath = join(outputDir, 'index.html')
  writeFileSync(indexPath, html, 'utf-8')

  // Copy static assets (reveal.js, mermaid, style.css)
  const staticSrc = join(__dirname, '../../static')
  if (existsSync(staticSrc)) {
    cpSync(staticSrc, outputDir, { recursive: true })
  }

  return indexPath
}
