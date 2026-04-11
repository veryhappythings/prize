# Configurable LLM Provider

## Context

Currently prize requires an `ANTHROPIC_API_KEY` and hardcodes `claude-opus-4-6`. The user wants to optionally use any OpenAI-compatible API (OpenRouter, Ollama, LM Studio, Azure, etc.) so they aren't locked into a specific provider or billing method.

## Approach

Introduce an `LLMClient` interface that abstracts the `callWithTool` pattern, with two implementations (Anthropic, OpenAI-compatible). A factory selects the provider based on env vars. The three analysis modules change only their type signatures — no logic changes.

## Changes

### 0. Update `CLAUDE.md`

Add project conventions:
- Always save plans into `docs/`
- Always update `docs/diary.md`

### 1. Create `src/llm/interface.ts` — LLMClient interface

```ts
export interface LLMClient {
  callWithTool<T>(
    systemPrompt: string,
    userMessage: string,
    toolName: string,
    toolDescription: string,
    inputSchema: Record<string, unknown>
  ): Promise<T>
}
```

### 2. Create `src/llm/providers/anthropic.ts` — AnthropicLLMClient

- Wraps the existing `@anthropic-ai/sdk` logic from `client.ts`
- Uses `client.messages.create()` with forced tool use
- Model defaults to `claude-sonnet-4-6` (configurable via `LLM_MODEL`)

### 3. Create `src/llm/providers/openai.ts` — OpenAILLMClient

- Uses the `openai` npm package
- Translates tool schema to OpenAI format (`{ type: 'function', function: { name, description, parameters } }`)
- Uses `tool_choice: { type: 'function', function: { name } }` for forced tool use
- Parses `tool_calls[0].function.arguments` (JSON string) with try/catch

### 4. Create `src/llm/factory.ts` — createLLMClient()

- Reads env vars to determine provider and construct the appropriate client
- Provider selection logic:
  - If `LLM_PROVIDER=openai` → use OpenAILLMClient with `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`
  - Otherwise → use AnthropicLLMClient with `ANTHROPIC_API_KEY` (or `LLM_API_KEY`), `LLM_MODEL`
- Validates required env vars and exits with helpful error messages

### 5. Update `src/config.ts`

- Add LLM config fields to `Config` interface: `llmProvider`, `llmApiKey`, `llmBaseUrl`, `llmModel`
- Remove hard requirement on `ANTHROPIC_API_KEY` — only require it when provider is anthropic
- Keep backward compatibility: `ANTHROPIC_API_KEY` alone still works as before

### 6. Update `src/pipeline/index.ts`

- Replace `getAnthropicClient(config.anthropicApiKey)` with `createLLMClient(config)`
- Change variable name from `anthropic` to `llm`
- Pass `llm` (type `LLMClient`) to analysis functions

### 7. Update analysis modules (minimal changes)

Each of `analyze-overview.ts`, `analyze-structure.ts`, `analyze-detail.ts`:
- Change import from `Anthropic` type / `callWithTool` to `LLMClient`
- Change parameter type from `Anthropic` to `LLMClient`
- Change `callWithTool(client, ...)` to `client.callWithTool(...)`

### 8. Delete `src/llm/client.ts`

All logic moved to providers. No longer needed.

### 9. Add `openai` dependency

```sh
yarn add openai
```

## File summary

| File | Action |
|------|--------|
| `src/llm/interface.ts` | Create |
| `src/llm/providers/anthropic.ts` | Create |
| `src/llm/providers/openai.ts` | Create |
| `src/llm/factory.ts` | Create |
| `src/config.ts` | Modify |
| `src/pipeline/index.ts` | Modify |
| `src/llm/analyze-overview.ts` | Modify (type signature only) |
| `src/llm/analyze-structure.ts` | Modify (type signature only) |
| `src/llm/analyze-detail.ts` | Modify (type signature only) |
| `src/llm/client.ts` | Delete |
| `package.json` | Modify (add openai dep) |

## Env var configuration

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `ANTHROPIC_API_KEY` | Only if provider=anthropic | — | Backward compatible |
| `LLM_PROVIDER` | No | `anthropic` | `anthropic` or `openai` |
| `LLM_API_KEY` | Only if provider=openai | — | Overrides provider-specific key |
| `LLM_BASE_URL` | No | Provider default | Custom endpoint URL |
| `LLM_MODEL` | No | `claude-sonnet-4-6` / provider default | Model identifier |

## Verification

1. **Backward compat**: `ANTHROPIC_API_KEY=... yarn dev <pr-url>` works exactly as before
2. **OpenAI-compatible**: `LLM_PROVIDER=openai LLM_API_KEY=... LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=anthropic/claude-sonnet-4 yarn dev <pr-url>` works via OpenRouter
3. **Missing config**: Running with no API key gives a clear error message
4. **Tests**: `yarn test` passes (existing tests don't test LLM calls)
5. **Build**: `yarn build` succeeds
