# pr-deck — Implementation Plan

## Context

Building a greenfield CLI tool that takes a GitHub PR URL, analyzes it with an LLM, and generates an interactive HTML slideshow to help humans review the PR. The repo currently has only `docs/spec.md`.

## Tech Stack

- **TypeScript + Node.js** — type safety, great ecosystem for GitHub/LLM SDKs
- **commander** — CLI parsing
- **@octokit/rest** — GitHub API
- **@anthropic-ai/sdk** — Claude for analysis
- **handlebars** — HTML templating
- **reveal.js** (vendored static) — slideshow framework with horizontal (pieces) + vertical (progressive depth) navigation
- **Mermaid.js** (vendored static) — UML diagrams rendered client-side from LLM-generated syntax
- **tsup** — TypeScript bundling
- **vitest** — testing

## Project Structure

```
src/
  cli.ts                    # Entry point: parse args, orchestrate
  config.ts                 # Env vars (GITHUB_TOKEN, ANTHROPIC_API_KEY), cache dir
  pipeline/
    index.ts                # Orchestrator: fetch → analyze → generate → serve
    fetch.ts                # GitHub data fetching
    analyze.ts              # LLM analysis orchestrator
    generate.ts             # HTML/slide generation
  github/
    client.ts               # Octokit wrapper
    pr.ts                   # PR metadata, files, diff, comments
    types.ts
  llm/
    client.ts               # Anthropic SDK wrapper with retry
    prompts/
      overview.md           # Prompt: high-level PR analysis
      structure.md          # Prompt: decompose PR into logical pieces
      detail.md             # Prompt: per-piece detailed analysis
    load-prompt.ts          # Read .md prompt files, interpolate variables
    analyze-overview.ts     # High-level PR analysis
    analyze-structure.ts    # Decompose into logical pieces
    analyze-detail.ts       # Per-piece detailed analysis
    types.ts
  slides/
    builder.ts              # Analysis → ordered slide deck
    types.ts
    templates/
      deck.hbs              # Main reveal.js HTML shell
      overview.hbs          # Overview slide
      component.hbs         # Piece slide
      code-detail.hbs       # Full code slide
      uml.hbs               # Mermaid diagram slide
  cache/
    index.ts                # File-based JSON cache with ordered invalidation
  server/
    index.ts                # Static HTTP server + browser open
  util/
    parse-url.ts            # Extract owner/repo/pr from GitHub URL
    logger.ts               # Console output with progress
static/
  reveal.js/                # Vendored reveal.js dist
  mermaid.min.js
  style.css                 # Custom slide styles
test/
  parse-url.test.ts
  cache.test.ts
  fixtures/
```

## Implementation Phases

### Phase 1: Scaffolding + CLI
- `yarn init`, install deps, configure TS/tsup
- `src/cli.ts` — commander, single positional arg (PR URL)
- `src/util/parse-url.ts` — extract owner/repo/number
- `src/config.ts` — read env vars, define cache dir `~/.pr-deck`
- `src/util/logger.ts` — simple console logging

### Phase 2: GitHub Data Fetching
- `src/github/client.ts` — authenticated Octokit
- `src/github/pr.ts`:
  - `fetchPRMetadata()` — title, body, author, labels, updated_at
  - `fetchPRFiles()` — changed files with stats
  - `fetchPRDiff()` — full unified diff (accept: `application/vnd.github.v3.diff`)
  - `fetchPRComments()` — review + inline comments
- Types in `src/github/types.ts`

### Phase 3: Caching Layer
- Cache dir: `~/.pr-deck/<owner>-<repo>-<pr_number>/`
- Ordered cache files: pr-metadata → pr-files → pr-diff → analysis-overview → analysis-structure → analysis-details → slides
- Invalidation: compare PR `updated_at`; if changed, invalidate downstream
- API: `cacheGet`, `cacheSet`, `cacheHas`, `cacheInvalidateFrom`

### Phase 4: LLM Analysis (3 sequential calls)

**Prompts as markdown files** in `src/llm/prompts/`:
- Each prompt is a standalone `.md` file with the full system/user prompt text
- Use `{{variable}}` placeholders for dynamic data (e.g. `{{prTitle}}`, `{{diff}}`)
- `src/llm/load-prompt.ts` reads the `.md` file and interpolates variables at runtime
- This makes prompts easy to edit, review in PRs, and iterate on without touching code

**Prompt files:**
- `overview.md` — takes: PR metadata, file list, PR body. Asks for: summary, motivation, risks, Jira ticket extraction, C4 context level
- `structure.md` — takes: overview result, full diff. Asks for: 3-10 logical pieces with files, review order, UML suggestions per piece
- `detail.md` — takes: piece definition, relevant file diffs. Asks for: piece summary, key signatures with explanations, walkthrough, issues, Mermaid code if requested

**Analysis calls:**
1. **Overview** — input: metadata + file list → output: summary, motivation, risks, Jira ticket, C4 context
2. **Structure** — input: overview + full diff → output: 3-10 logical pieces with files, review order, UML suggestions
3. **Detail** (per piece, parallelizable) — input: piece def + relevant diffs → output: summary, signatures, walkthrough, issues, Mermaid code

Use Anthropic tool-use/structured output for reliable JSON parsing. Cache each step independently.

### Phase 5: Slide Generation
Progressive reveal via reveal.js horizontal + vertical slides:
- **Horizontal**: title → overview → map → [pieces...] → summary
- **Vertical per piece**: summary → UML (optional) → signatures → walkthrough → full diff → issues (optional)

Handlebars templates compile to single `index.html`. Static assets copied to output dir.

### Phase 6: Dev Server + Browser
- `node:http` static file server
- Auto-pick available port (start 3000)
- Open browser with `open` package
- Keep running until Ctrl+C

### Phase 7: Polish
- Flags: `--force`, `--port`, `--no-open`
- Progress spinners during LLM analysis
- Error handling for missing tokens, API failures
- README

## Data Flow

```
PR URL → parse-url → { owner, repo, number }
  → github/pr → PRData (metadata, files, diff, comments) [cached]
  → llm/analyze-overview → OverviewAnalysis [cached]
  → llm/analyze-structure → StructureAnalysis (pieces, order) [cached]
  → llm/analyze-detail → DetailAnalysis[] per piece [cached]
  → slides/builder → SlideDeck
  → pipeline/generate → ~/.pr-deck/<id>/site/index.html
  → server → http://localhost:3000 → browser
```

## Key Design Decisions

- **Reveal.js horizontal = pieces, vertical = depth** — reviewer navigates right through pieces, down into detail
- **Mermaid client-side** — LLM generates Mermaid syntax, browser renders to SVG
- **Large PR handling** — structure call gets only file list (not full diff); detail calls get only per-piece diffs
- **Vendored static assets** — reveal.js/mermaid shipped as files, not npm packages (they run in browser)

## Verification
1. `yarn tsx src/cli.ts https://github.com/<some-public-repo>/pull/<n>` — end to end
2. Verify cache files appear in `~/.pr-deck/`
3. Verify browser opens with slideshow
4. Re-run same PR — should skip LLM calls (cache hit)
5. Run `yarn test` for unit tests
