#!/usr/bin/env node
import { Command } from 'commander'
import { loadConfig } from './config.js'
import { parsePRUrl } from './util/parse-url.js'
import { run } from './pipeline/index.js'

const program = new Command()

program
  .name('pr-deck')
  .description('Augment and structure human PR reviews with LLM analysis')
  .version('0.1.0')
  .argument('<pr-url>', 'GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)')
  .option('-f, --force', 'bypass cache and re-analyze from scratch', false)
  .option('-p, --port <number>', 'port for the local server', '3000')
  .option('--no-server', 'generate the site but do not serve it')
  .option('--no-open', 'serve the site but do not open the browser')
  .action(async (prUrl: string, options: { force: boolean; port: string; server: boolean; open: boolean }) => {
    try {
      const config = loadConfig()
      const ref = parsePRUrl(prUrl)
      console.log(`\npr-deck — ${ref.owner}/${ref.repo}#${ref.number}\n`)
      await run(ref, config, {
        force: options.force,
        port: parseInt(options.port, 10),
        noServer: !options.server,
        noOpen: !options.open,
      })
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program.parse()
