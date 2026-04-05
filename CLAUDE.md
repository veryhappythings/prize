# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
yarn dev <pr-url>      # run the CLI without building (tsx)
yarn build             # compile to dist/ with tsup
yarn test              # run all tests
yarn test --reporter=verbose  # run tests with output
```

To run a single test file:
```sh
yarn vitest run test/cache.test.ts
```

Required env vars before running:
```sh
export GITHUB_TOKEN=...
export ANTHROPIC_API_KEY=...   # default provider (anthropic)

# Or to use any OpenAI-compatible API (OpenRouter, Ollama, Azure, etc.):
export LLM_PROVIDER=openai
export LLM_API_KEY=...
export LLM_BASE_URL=https://openrouter.ai/api/v1   # optional
export LLM_MODEL=anthropic/claude-sonnet-4          # optional
```

## Conventions

- Always save implementation plans into `docs/`
- Always update `docs/diary.md` after completing work

## Architecture

The tool is a pipeline: **fetch → analyze → generate → serve**. Each step's output is cached in `~/.pr-deck/<owner>-<repo>-<pr_number>/` and skipped on re-runs if the PR `updated_at` hasn't changed.

### Pipeline flow (`src/pipeline/index.ts`)

1. `src/github/pr.ts` — fetches PR metadata, file list, unified diff, and comments via Octokit
2. `src/llm/analyze-overview.ts` → `analyze-structure.ts` → `analyze-detail.ts` — three sequential LLM calls that progressively decompose the PR
3. `src/slides/builder.ts` — transforms analysis into a `SlideDeck` (groups of slides)
4. `src/pipeline/generate.ts` — renders Handlebars templates to a static `index.html`
5. `src/server/index.ts` — serves the site locally and opens the browser

### LLM analysis

Three passes, each building on the previous:
- **Overview** — summary, motivation, C4 context, Jira ticket extraction
- **Structure** — decomposes the PR into 3–10 named logical "pieces" with a recommended review order
- **Detail** — per-piece: key signatures, walkthrough prose, issues, optional Mermaid diagram

All calls use Anthropic tool use (`tool_choice: { type: 'tool' }`) to get structured JSON output. Prompts live as plain markdown files in `src/llm/prompts/` with `{{variable}}` placeholders interpolated at runtime by `src/llm/load-prompt.ts`.

### Slide structure

The output is a reveal.js slideshow with **horizontal navigation = pieces** and **vertical navigation = depth within a piece**. The vertical stack per piece is: summary → UML (optional) → signatures → walkthrough → code (one slide per file) → issues (optional).

Handlebars templates are in `src/slides/templates/`. The `deck.hbs` shell references partials by slide type, resolved at render time via a `slide_partial` helper.

### Cache invalidation order

Cache keys are ordered in `src/cache/index.ts`. Invalidating a key removes it and all downstream keys:
```
pr-metadata → pr-files → pr-diff → analysis-overview → analysis-structure → analysis-details → slides
```

### Static assets

`static/` contains vendored reveal.js 5.2.1 (in `static/reveal/`) and mermaid 11 (`static/mermaid.min.js`). These are copied verbatim into the generated site directory — they are not npm dependencies.
