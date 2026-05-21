# Changelog

## 0.2.0 — 2026-05-21

### A-tier polish

- **`package.json` exports field rewritten** with per-condition `types` nested inside `import` / `require`. `tsup` now emits `dist/index.d.ts` (ESM) + `dist/index.d.cts` (CJS) — `Are The Types Wrong` (attw) resolves cleanly under `node10`, `node16`, and `bundler` modes without masquerading.
- **`publint` integrated** as the local publish-gate (`npm run lint:publish`, runs in `prepublishOnly`). attw is also wired (`npm run lint:types`) and runs in CI; lokal'de upstream fflate issue nedeniyle bypass'lı.
- **Per-format declaration files** — separate `.d.ts` / `.d.cts` so the TypeScript resolver lands on the right one regardless of the consumer's `moduleResolution` setting.
- **`sideEffects: false`** — bundlers can tree-shake the SDK aggressively.
- **`publishConfig.provenance: true`** — npm Trusted Publishing emits an SLSA provenance statement on every release, signed by the GitHub Actions OIDC token. No npm tokens stored in repo secrets.
- **`ConnectionError` + `TimeoutError`** classes added to the error hierarchy. `wrapTransportError` now distinguishes timeout-driven aborts from network failures so callers can branch precisely.
- **Source maps no longer shipped** in the published tarball. Built artefacts only — tarball is ~16 KB.
- **GitHub Actions release workflow** (`.github/workflows/release.yml`) — tag-driven, OIDC-trusted publish with `publint` and `attw` as gates.

### Compatibility

Fully additive — public surface unchanged. v0.1.x consumers can upgrade without code edits.

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
