# Plan: C4 diagram in the C4 Context section

## Problem

The C4 Context section is prose only. Mermaid's C4 support is poor: its layout ignores boundaries, overlaps labels, and the LLM often writes invalid syntax.

## Approach

Don't ask the LLM for diagram syntax. Ask it for a **structured C4 model** as part of the overview tool call, and render it ourselves.

1. **Model** (`src/llm/types.ts`): `C4Diagram` = elements (person / system / external system / container / database / component), boundaries (optionally nested), relationships. Elements and relationships carry a `changed` flag so the diagram highlights what the PR touches.
2. **LLM** (`src/llm/analyze-overview.ts`, `prompts/overview.md`): add a `c4Diagram` property to the `submit_overview` schema. The LLM picks the zoom level: people/external systems around the system boundary, containers inside it, and components only for the containers the PR changes.
3. **Normalise** (`src/diagrams/c4.ts`): drop relationships to unknown ids, self-loops and duplicates; clear unknown or cyclic boundary refs; drop empty boundaries. A bad model degrades to a smaller diagram, not a crash.
4. **Layout**: [elkjs](https://github.com/kieler/elkjs) `layered` algorithm, top-down, orthogonal edges, `INCLUDE_CHILDREN` so boundaries are real compound nodes and edges cross them cleanly. Edge labels are sized and placed by ELK so they don't overlap.
5. **Render**: our own SVG with C4 styling (standard C4 colours, person and cylinder shapes, dashed boundaries, `[kind: technology]` lines, yellow outline for changed elements and relationships, legend). Done at generate time in Bun, so the page ships a static SVG and needs no diagram JS.

## Why not the alternatives

- **Mermaid C4**: the reason for this change.
- **PlantUML / Structurizr**: need Java or a remote server.
- **D2**: good layouts, but needs a Go binary or a large WASM bundle.
- **Graphviz (WASM)**: workable, but styling C4 shapes through HTML-like labels is clumsy. ELK gives coordinates and we draw exactly what we want.

## Bun quirk

`elkjs/lib/elk.bundled.js` sees Bun's global `Worker` and tries to start a real worker, which fails. `elk-worker.min.js` sees Bun's global `self` and registers itself as a worker instead of exporting `FakeWorker`. We hide `self` while requiring it, then pass `FakeWorker` to `elk-api` as the `workerFactory`. This works both under `bun run` and in the `bun build` bundle.

## Compatibility

`c4Diagram` is optional. Overviews cached before this change have no diagram, and the section falls back to prose only. Use `--force` to regenerate.
