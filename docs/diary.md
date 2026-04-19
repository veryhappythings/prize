# Implementation Diary

## 2026-04-05 — Phase 1: Scaffolding

Starting from zero. Repo has only `docs/spec.md`.

Plan written to `docs/plan.md`. Stack: TypeScript, yarn, commander, @octokit/rest, @anthropic-ai/sdk, handlebars, reveal.js (vendored), tsup, vitest.

Beginning with project scaffolding: package.json, tsconfig, tsup config, then CLI skeleton.

### What was built

All 7 phases implemented in one pass:

- `src/cli.ts` — commander CLI with `--force`, `--port`, `--no-open`
- `src/config.ts` — reads `GITHUB_TOKEN` and `ANTHROPIC_API_KEY`
- `src/util/parse-url.ts` — GitHub PR URL parser
- `src/util/logger.ts` — spinner + progress logging
- `src/github/` — Octokit wrapper, fetchPRMetadata/Files/Diff/Comments
- `src/cache/index.ts` — file-based JSON cache with ordered invalidation
- `src/llm/` — Anthropic client, three analysis passes (overview → structure → detail)
- `src/llm/prompts/*.md` — prompt templates as standalone markdown files with `{{variable}}` interpolation
- `src/slides/builder.ts` — transforms analysis into reveal.js slide deck (horizontal pieces, vertical depth)
- `src/slides/templates/*.hbs` — Handlebars templates for each slide type
- `src/pipeline/generate.ts` — renders HTML site
- `src/server/index.ts` — static file server + browser open
- `static/` — vendored reveal.js 5.2.1, mermaid 11, custom CSS

### Test results
- 11 unit tests passing (parse-url, cache)
- TypeScript build: clean (25.6 KB bundle)

### To run
```sh
export GITHUB_TOKEN=...
export ANTHROPIC_API_KEY=...
yarn dev https://github.com/owner/repo/pull/123
```

## 2026-04-05 — Configurable LLM provider

Plan: `docs/plan-configurable-llm.md`

The tool previously required an Anthropic API key. Added support for any OpenAI-compatible API so users aren't locked into a specific billing model.

### What changed

- `src/llm/interface.ts` — new `LLMClient` interface with `callWithTool<T>()`
- `src/llm/providers/anthropic.ts` — `AnthropicLLMClient` (wraps existing SDK logic)
- `src/llm/providers/openai.ts` — `OpenAILLMClient` (OpenAI-compatible, handles JSON arg parsing)
- `src/llm/factory.ts` — `createLLMClient(config)` selects provider from env vars
- `src/llm/client.ts` — deleted (logic moved to providers)
- `src/config.ts` — replaced `anthropicApiKey` with `llmProvider`, `llmApiKey`, `llmBaseUrl`, `llmModel`
- `src/pipeline/index.ts` — uses `createLLMClient` instead of `getAnthropicClient`
- Three analysis modules — type signature change only (`Anthropic` → `LLMClient`)

### Env vars

| Var | Default | Notes |
|-----|---------|-------|
| `ANTHROPIC_API_KEY` | — | Still works as before (backward compat) |
| `LLM_PROVIDER` | `anthropic` | `anthropic` or `openai` |
| `LLM_API_KEY` | — | Overrides provider-specific key |
| `LLM_BASE_URL` | Provider default | Custom endpoint (e.g. OpenRouter) |
| `LLM_MODEL` | `claude-sonnet-4-6` | Model identifier |

### Test results
- 11 unit tests passing
- TypeScript build: clean (27.63 KB bundle)

## 2026-04-05 — Amazon Bedrock provider

Added `LLM_PROVIDER=bedrock` support via the Bedrock Converse API.

### What changed

- `src/llm/providers/bedrock.ts` — new `BedrockLLMClient` using `@aws-sdk/client-bedrock-runtime`
- `src/llm/factory.ts` — added `bedrock` case
- `src/config.ts` — added `'bedrock'` to provider union, `awsRegion` field, skips API key check for Bedrock
- `package.json` — added `@aws-sdk/client-bedrock-runtime` dependency
- `CLAUDE.md` — documented Bedrock env vars

### Design notes

Uses the Converse API (`ConverseCommand`) which has native tool use. Forced tool choice via `toolConfig.toolChoice: { tool: { name } }`. Response is already-parsed JSON (same as Anthropic SDK), so no manual `JSON.parse` needed.

Authentication uses the standard AWS credential chain — `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, IAM role, AWS SSO, etc. No `LLM_API_KEY` required.

### Env vars

| Var | Default | Notes |
|-----|---------|-------|
| `LLM_PROVIDER` | `anthropic` | Set to `bedrock` |
| `AWS_REGION` | `us-east-1` | Bedrock region |
| `LLM_MODEL` | `us.anthropic.claude-sonnet-4-6-v1:0` | Any Bedrock model ID |

### Test results
- 11 unit tests passing
- TypeScript build: clean (29.36 KB bundle)

## 2026-04-10 — Sidebar + detail page layout (farewell reveal.js)

Replaced the reveal.js slideshow with a GitHub PR review-style layout: fixed sidebar on the left, scrollable detail pane on the right.

### Motivation

The slideshow model required users to navigate horizontally through pieces and vertically through depth, which felt like clicking through a presentation. A scrollable page with a persistent navigation sidebar is more natural for code review — you can skim, jump around, and read at your own pace.

### What changed

**New layout (`src/slides/templates/deck.hbs` — full rewrite)**
- Two-column body: `.sidebar` (260px fixed) + `.detail-pane` (flex: 1, scrollable)
- Sidebar lists all sections (title, overview, pieces in review order, summary); map slide is silently skipped since the sidebar replaces it
- Scroll-spy via `IntersectionObserver` highlights the active section in the sidebar
- Smooth scroll on sidebar link click
- Mermaid diagrams rendered on `DOMContentLoaded` (previously lazy-rendered on slide change)
- Standalone `highlight.min.js` (11.9.0) vendored to `static/` — the reveal plugin bundle exposed `RevealHighlight`, not `hljs`

**Templates (`src/slides/templates/*.hbs`)**
- All 10 partials: outer `<section>` → `<div>` (reveal.js needed sections, plain HTML doesn't)
- Removed the "Press ↓ to explore" navigation hint from `piece-summary.hbs`
- Added `<div class="issue-body">` wrapper in `issues.hbs` so flex layout correctly constrains text reflow

**New Handlebars helpers (`src/pipeline/generate.ts`)**
- `is_map` — skips the map group during rendering
- `section_label` — extracts human-readable sidebar label from a slide (piece name, "Overview", etc.)

**CSS (`static/style.css` — major rewrite)**
- Removed all `.reveal`-prefixed selectors and slide viewport constraints
- Added layout shell: body flex, sidebar, detail-pane, content-section, content-subsection
- Converted tiny relative font sizes (0.45em–0.75em, sized for reveal's scaled viewport) to `rem`-based values
- Removed `max-height` scroll traps that existed to fit content into slide dimensions
- Fixed code diff overflow: `pre { width: 0; min-width: 100%; overflow-x: auto }` pattern constrains the block to the container width while allowing internal horizontal scroll
- Fixed issues card overflow: `min-width: 0` on flex child + `word-break: break-word` on `.issue-body`

### Data model

Untouched. `SlideDeck`, `SlideGroup`, `Slide` types and `builder.ts` unchanged — the builder still creates the map group, it just isn't rendered.

### Test results
- 34 unit tests passing (unchanged)
- TypeScript build: clean

## 2026-04-12 — Migrate from yarn/tsx/tsup/vitest to Bun

Replaced the entire Node.js toolchain with Bun as package manager, dev runner, bundler, and test runner.

### Motivation

Fewer tools, faster installs, faster tests. Bun handles everything that previously required four separate dev dependencies.

### What changed

**Removed devDependencies**: `tsup`, `tsx`, `vitest`

**Added devDependencies**: `@types/bun`

**`package.json` scripts**:
- `dev`: `tsx src/cli.ts` → `bun run src/cli.ts`
- `build`: `tsup && cp -r ...` → `bun build --target=bun --minify --sourcemap --outdir=dist src/cli.ts && mv dist/cli.js dist/prize`
- `test`: `vitest run` → `bun test`
- `test:watch`: `vitest` → `bun test --watch`
- `typecheck` (new): `tsc --noEmit`

**Asset loading** (`src/llm/load-prompt.ts`, `src/pipeline/generate.ts`):
- Replaced `readFileSync` + `findProjectRoot()` runtime path walking with static `import ... with { type: 'text' }` imports for all `.md` prompts, `.hbs` templates, and `static/` CSS/JS assets.
- Assets are now bundled into `dist/prize` at build time, so the CLI works correctly when run from any directory without needing `src/` on disk.

**Test files** (`test/*.test.ts`): `import ... from 'vitest'` → `import ... from 'bun:test'`

**`bunfig.toml`** (new): scopes `bun test` to `./test/`

**TypeScript declarations** (`src/asset-types.d.ts`, `static/*.min.d.ts`): added module declarations so `tsc --noEmit` accepts the non-TS imports.

**Pre-commit hooks** (`.pre-commit-config.yaml`): `yarn lint/tsc/test` → `bun run lint/typecheck/test`

**Shebang** (`src/cli.ts`): `#!/usr/bin/env node` → `#!/usr/bin/env bun`

**Deleted**: `tsup.config.ts`, `yarn.lock`

### Design notes

`bun build --compile` (native binary) was attempted but produces an ARM64 Mach-O that macOS kills with SIGKILL on this machine (unsigned binary). The bundled-JS approach (`--target=bun --outdir`) produces a 4.2MB JS file interpreted by bun, which works without code signing and is equally self-contained for local use.

### Test results
- 34 unit tests passing
- TypeScript: clean
- Full pipeline verified against cached kubernetes/kubernetes#138214

## 2026-04-18 — Space out C4 context

The C4 context paragraph in the overview section was rendering as one dense block.

**`src/pipeline/generate.ts`**: `md` helper now converts runs of two or more newlines into `<br><br>`, so blank-line-separated paragraphs from the LLM render with vertical space inside the existing `<p>` wrapper.

**`src/llm/analyze-overview.ts` + `src/llm/prompts/overview.md`**: tightened the `c4Context` description/prompt to ask for 2–3 short paragraphs separated by blank lines — one per relevant C4 level (System → Containers → Components), skipping any that don't apply.

### Test results
- 34 tests passing, lint + typecheck clean

## 2026-04-18 — Break C4 context into its own section

The previous patch spaced the C4 paragraph with `<br><br>`, but it still sat squeezed inside the half-width overview column next to Motivation. Promoted it to a top-level section so it gets full width and its own sidebar entry.

- `src/sections/types.ts`: new `C4ContextSection` (`type: 'c4-context'`, `context: string`); removed `c4Context` from `OverviewSection`.
- `src/sections/builder.ts`: drops `c4Context` from the overview group and appends a standalone `c4-context` group between overview and map. Skipped entirely if `overview.c4Context` is blank.
- `src/sections/templates/overview.hbs`: removed the two-column grid; motivation is now a single full-width block.
- `src/sections/templates/c4-context.hbs` (new): `<h2>C4 Context</h2>` + body rendered via a new `mdBlock` helper that splits on blank lines into real `<p>` blocks.
- `src/pipeline/generate.ts`: registered the new template + partial, added `mdBlock` helper, added `'C4 Context'` sidebar label for the new section type.
- `static/style.css`: dropped `.overview-grid`, made `.overview-block` full-width, added `.section-c4-context` / `.c4-context-body` rules so paragraphs get proper vertical spacing.
- `test/builder.test.ts`: indices updated (pieces now start at `groups[4]`), added a c4-context carry-over test and a test for the blank-context omission.

### Test results
- 36 tests passing, lint + typecheck clean

## 2026-04-18 — Unify `md` and `mdBlock` helpers

The previous patch added an `mdBlock` helper for C4 context that duplicated 90% of the existing `md` helper's escape + inline transforms, differing only in how it joined paragraphs. Collapsed them into a single `md` helper whose output adapts to the input: one paragraph returns inline HTML (safe inside `<span>`, `<td>`, etc.), multiple paragraphs return one `<p>` per block.

- `src/pipeline/generate.ts`: replaced both helpers with a single `md` that splits on blank lines, runs escape + inline once per paragraph, and only wraps in `<p>` when there's more than one. Deleted `mdBlock`.
- Templates that wrapped `{{{md ...}}}` in a `<p class="...">` would nest `<p>` inside `<p>` if the content went multi-paragraph, so switched them to `<div class="...">`:
  - `overview.hbs` (summary, motivation)
  - `walkthrough.hbs` (walkthrough-text)
  - `summary.hbs` (summary-text)
  - `piece-summary.hbs` (piece-description)
- `c4-context.hbs`: `{{{mdBlock ...}}}` → `{{{md ...}}}`.
- `map.hbs`, `signatures.hbs`, `issues.hbs` unchanged — they host `md` in inline or block-accepting contexts that work either way.

### Test results
- 36 tests passing, lint + typecheck clean

## 2026-04-19 — Link file references to GitHub PR diff anchors

Every file reference in the generated page (piece file lists, signatures table, code diff headings, and backticked paths in LLM prose) was plain text. Added linking so each reference opens the file's diff in the PR "Files changed" tab.

GitHub's per-file anchor is `#diff-<sha256(filename)>` computed client-side — the API does not return it.

### What was built

- `src/util/pr-links.ts` (new): `fileAnchor(filename)` → `diff-<hex>` and `fileLink(prUrl, filename)` → full URL. Uses `node:crypto` `createHash('sha256').update(filename, 'utf8')`.
- `src/sections/types.ts`: added `prUrl: string` and `prFiles: string[]` to the `Page` interface.
- `src/sections/builder.ts`: populates `prUrl` from `metadata.htmlUrl` and `prFiles` from the file list.
- `src/pipeline/generate.ts`:
  - `registerHelpers` is now exported and takes a `Page` argument; builds a `Set<string>` of PR filenames once per render via closure.
  - New `file_link` Handlebars helper: renders a filename as `<a class="file-ref" href="..." target="_blank" rel="noreferrer">`.
  - `md` helper extended: backtick content is looked up in the PR filename set (after stripping trailing `:N` / `#LN` line references); matches are wrapped in `<a>` around the `<code>` tag.
- `src/sections/templates/piece-summary.hbs`, `signatures.hbs`, `code.hbs`: switched `{{...}}` to `{{{file_link ...}}}`.
- Prose templates (`walkthrough`, `issues`, `map`, `overview`, `c4-context`, `summary`) unchanged — they already go through `{{{md ...}}}`.

### Tests

- `test/pr-links.test.ts` (new): hash correctness with reference implementation, round-trip, case sensitivity, space-in-filename (catches accidental `encodeURIComponent`).
- `test/builder.test.ts`: added assertions for `prUrl` and `prFiles` on the returned `Page`.
- `test/generate-links.test.ts` (new): `file_link` helper, all three structured templates, `md` prose autolinking (match, non-match, `:N` stripping, `#LN` stripping, empty prUrl degradation).

### Test results
- 57 tests passing, lint + typecheck clean
