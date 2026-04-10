import { join } from 'node:path'
import type { Config } from '../config.js'
import type { PRRef } from '../util/parse-url.js'
import { prCacheKey } from '../util/parse-url.js'
import { logger } from '../util/logger.js'
import { Cache } from '../cache/index.js'
import { getOctokit } from '../github/client.js'
import { fetchPRData, fetchPRMetadata } from '../github/pr.js'
import { createLLMClient } from '../llm/factory.js'
import { analyzeOverview } from '../llm/analyze-overview.js'
import { analyzeStructure } from '../llm/analyze-structure.js'
import { analyzeAllDetails } from '../llm/analyze-detail.js'
import { buildSlideDeck } from '../slides/builder.js'
import { generateSite } from './generate.js'
import { startServer } from '../server/index.js'
import type { PRData } from '../github/types.js'
import type { OverviewAnalysis, StructureAnalysis, DetailAnalysis, AllAnalysis } from '../llm/types.js'

export interface RunOptions {
  force?: boolean
  port?: number
  noServer?: boolean
  noOpen?: boolean
}

export async function run(ref: PRRef, config: Config, opts: RunOptions = {}) {
  const octokit = getOctokit(config.githubToken)
  const llm = createLLMClient(config)
  const cacheKey = prCacheKey(ref)
  const cache = new Cache(config.cacheDir, cacheKey)

  if (opts.force) {
    logger.info('Force flag set — clearing cache')
    cache.invalidateFrom('pr-metadata')
  }

  // ── Step 1: Check for cache invalidation by comparing updated_at ──────────
  let prData: PRData

  if (cache.has('pr-metadata') && !opts.force) {
    const cachedMeta = cache.get<PRData['metadata']>('pr-metadata')!
    logger.startSpinner('Checking for PR updates...')
    const freshMeta = await fetchPRMetadata(octokit, ref.owner, ref.repo, ref.number)
    logger.stopSpinner()

    if (freshMeta.updatedAt !== cachedMeta.updatedAt) {
      logger.info('PR has been updated — invalidating cache from pr-files onwards')
      cache.invalidateFrom('pr-files')
      cache.set('pr-metadata', freshMeta)
    }

    if (cache.has('pr-files') && cache.has('pr-diff')) {
      logger.success('Using cached PR data')
      prData = {
        metadata: freshMeta,
        files: cache.get('pr-files')!,
        diff: cache.getText('pr-diff')!,
        comments: cache.get('pr-metadata')
          ? (cache.get<PRData>('pr-metadata') as PRData)?.comments ?? []
          : [],
      }
    } else {
      prData = await fetchAndCachePR(octokit, ref, cache)
    }
  } else {
    prData = await fetchAndCachePR(octokit, ref, cache)
  }

  // ── Step 2: Overview analysis ──────────────────────────────────────────────
  let overview: OverviewAnalysis
  if (cache.has('analysis-overview')) {
    logger.success('Using cached overview analysis')
    overview = cache.get<OverviewAnalysis>('analysis-overview')!
  } else {
    logger.startSpinner('Analyzing PR overview...')
    overview = await analyzeOverview(llm, prData)
    cache.set('analysis-overview', overview)
    logger.stopSpinner('Overview analysis complete')
  }

  // ── Step 3: Structure analysis ─────────────────────────────────────────────
  let structure: StructureAnalysis
  if (cache.has('analysis-structure')) {
    logger.success('Using cached structure analysis')
    structure = cache.get<StructureAnalysis>('analysis-structure')!
  } else {
    logger.startSpinner('Decomposing PR into logical pieces...')
    structure = await analyzeStructure(llm, overview, prData.diff)
    cache.set('analysis-structure', structure)
    logger.stopSpinner(`Found ${structure.pieces.length} logical pieces`)
  }

  // ── Step 4: Detail analysis (per piece) ───────────────────────────────────
  let details: Record<string, DetailAnalysis>
  if (cache.has('analysis-details')) {
    logger.success('Using cached detail analyses')
    details = cache.get<Record<string, DetailAnalysis>>('analysis-details')!
  } else {
    logger.info(`Analyzing ${structure.pieces.length} pieces...`)
    let done = 0
    details = await analyzeAllDetails(llm, structure.pieces, prData.files, (pieceId) => {
      done++
      logger.info(`  [${done}/${structure.pieces.length}] Analyzed: ${pieceId}`)
    })
    cache.set('analysis-details', details)
    logger.success('Detail analysis complete')
  }

  // ── Step 5: Build slide deck ───────────────────────────────────────────────
  const analysis: AllAnalysis = { overview, structure, details }
  const deck = buildSlideDeck(prData, analysis)
  cache.set('slides', deck)

  // ── Step 6: Generate HTML site ─────────────────────────────────────────────
  const siteDir = join(config.cacheDir, cacheKey, 'site')
  logger.startSpinner('Generating slideshow...')
  const indexPath = await generateSite(deck, siteDir)
  logger.stopSpinner(`Generated: ${indexPath}`)

  // ── Step 7: Serve + open browser ──────────────────────────────────────────
  if (!opts.noServer) {
    await startServer(siteDir, opts.port ?? 3000, !opts.noOpen)
  } else {
    logger.success(`Site ready at: ${siteDir}`)
  }
}

async function fetchAndCachePR(
  octokit: ReturnType<typeof getOctokit>,
  ref: PRRef,
  cache: Cache
): Promise<PRData> {
  logger.startSpinner(`Fetching PR #${ref.number} from GitHub...`)
  const prData = await fetchPRData(octokit, ref.owner, ref.repo, ref.number)
  cache.set('pr-metadata', prData.metadata)
  cache.set('pr-files', prData.files)
  cache.setText('pr-diff', prData.diff)
  logger.stopSpinner(`Fetched PR: ${prData.metadata.title}`)
  return prData
}
