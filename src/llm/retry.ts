const MAX_RETRIES = 5

function getRateLimitWaitMs(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null

  const e = err as Record<string, unknown>

  // Anthropic + OpenAI SDKs: status 429
  if (e['status'] === 429) {
    const headers = e['headers'] as Record<string, string> | undefined
    if (headers) {
      // Anthropic uses retry-after-ms; OpenAI uses retry-after (seconds)
      const ms = headers['retry-after-ms']
      if (ms) return parseInt(ms, 10)
      const s = headers['retry-after']
      if (s) return parseInt(s, 10) * 1000
    }
    return 60_000
  }

  // Bedrock: ThrottlingException
  const name = (e['name'] ?? e['__type']) as string | undefined
  if (name === 'ThrottlingException') return 60_000

  return null
}

export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const waitMs = getRateLimitWaitMs(err)
      if (waitMs === null || attempt === MAX_RETRIES) throw err
      const waitSec = Math.ceil(waitMs / 1000)
      process.stderr.write(
        `[prize] rate limit hit — waiting ${waitSec}s before retry (attempt ${attempt + 1}/${MAX_RETRIES})...\n`
      )
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  /* istanbul ignore next */
  throw new Error('unreachable')
}
