# Changelog

## 0.1.0 — 2026-05-06

Initial release. Beta.

### Added
- Single `Brime` class (alias `BrimeClient`) — async methods covering `/v1/*`
- `search`, `extract`, `research`, `researchStatus`, `researchStream` methods
- `research({ depth: "deep", wait: true })` blocking polling helper with exponential backoff
- `researchStream(...)` returns an `AsyncIterable<ResearchSseEvent>` (use `for await`)
- Auto-generated `Idempotency-Key` for `extract` and deep `research` calls
- Error hierarchy: `BrimeError` → `AuthenticationError`, `RateLimitError`, `InsufficientCreditsError`, `InvalidRequestError`, `NotFoundError`, `UpstreamError`, `InternalError`
- `BRIME_API_KEY` and `BRIME_BASE_URL` env-var fallbacks
- Dual ESM + CJS build with TypeScript declarations; works on Node 18+, Bun, Deno, Cloudflare Workers, modern browsers
- Zero external HTTP dependencies (native `fetch`, `AbortController`, `crypto.randomUUID`)
- 29 unit tests + 8 live e2e gates (all green vs production)
