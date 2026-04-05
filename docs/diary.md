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
