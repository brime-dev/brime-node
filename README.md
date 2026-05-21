# brime — Node.js / TypeScript SDK

Official SDK for the [Brime API](https://brime.dev) — search, extract, and research the web with a single API key.

```bash
npm install brime
```

Works in Node.js 18+, Bun, Deno, Cloudflare Workers, and modern browsers (native `fetch` + `ReadableStream`). Zero external HTTP dependencies. Ships ESM + CJS + TypeScript declarations.

## Quickstart

### Search

```ts
import { Brime } from "brime";

const client = new Brime({ apiKey: "sk-brime-..." });

const result = await client.search({ query: "BM25 ranking algorithm" });
console.log(result.answer);
for (const r of result.results) {
  console.log(`- ${r.title}  ${r.url}`);
}
```

### Extract

```ts
const result = await client.extract({
  urls: ["https://example.com", "https://en.wikipedia.org/wiki/BM25"],
});

for (const r of result.results) {
  console.log(r.url, r.method, r.markdown.length);
}
for (const f of result.failed) {
  console.log("FAIL", f.url, f.error.code, f.error.message);
}
```

### Research (basic — synchronous)

```ts
const result = await client.research({
  query: "what is the okapi bm25 formula",
  depth: "basic",
});
console.log(result.answer);
console.log(`Sources: ${result.sources.length}`);
```

### Research (deep — wait for completion)

```ts
const result = await client.research({
  query: "compare frontier coding models with concrete benchmark numbers",
  depth: "deep",
  wait: true,
  poll_interval: 10,   // seconds between status polls
  poll_timeout: 420,   // seconds total
});
console.log(result.status); // "complete" | "errored" | "timeout"
console.log(result.answer);
console.log(`Sources: ${result.sources_count}, rounds: ${result.current_round}`);
```

### Research stream (live SSE)

```ts
for await (const evt of client.researchStream({
  query: "what is BM25",
  depth: "deep",
})) {
  console.log(evt.event, evt.data);
  if (evt.event === "complete" || evt.event === "error" || evt.event === "timeout") {
    break;
  }
}
```

## Authentication

```bash
export BRIME_API_KEY="sk-brime-..."
```

```ts
new Brime();                            // uses BRIME_API_KEY
new Brime({ apiKey: "sk-brime-..." });  // explicit override
new Brime({ baseUrl: "https://..." });  // staging override (or BRIME_BASE_URL env)
```

## Search depth

| `depth`     | Behaviour                                                    | Credits |
|-------------|--------------------------------------------------------------|---------|
| `instant`   | SERP snippets, no scrape, no LLM answer (cache-first)        | 0.5     |
| `basic`     | SERP + chunk + BM25 + LLM answer (default)                   | 1       |
| `advanced`  | `basic` + advanced BM25 (Lv & Zhai 2011) + chunk reranking   | 2       |

Common filters work on every depth:

```ts
await client.search({
  query: "tesla earnings",
  depth: "advanced",
  topic: "finance",
  time_range: "week",
  domains: ["sec.gov", "investor.tesla.com"],
  exclude_domains: ["seekingalpha.com"],
  max_results: 10,
});
```

## Error handling

```ts
import {
  Brime,
  BrimeError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  InvalidRequestError,
  NotFoundError,
  UpstreamError,
  InternalError,
} from "brime";

try {
  await client.search({ query: "..." });
} catch (e) {
  if (e instanceof AuthenticationError) console.error("Bad API key");
  else if (e instanceof RateLimitError) console.error("Slow down");
  else if (e instanceof InsufficientCreditsError) console.error("Top up at brime.dev/billing");
  else if (e instanceof BrimeError) console.error(`${e.code} (HTTP ${e.status}): ${e.message}`);
  else throw e;
}
```

## Idempotency

`/v1/extract` and deep `/v1/research` calls require an `Idempotency-Key`. The SDK auto-generates a UUID per call so retries against the same call site won't double-charge. Override with `idempotencyKey` when you want explicit deduplication across processes:

```ts
await client.extract(
  { urls: ["https://x"] },
  { idempotencyKey: "my-stable-key-2026-05-06" },
);
```

For deep research, set `idempotency_key` on the request:

```ts
await client.research({
  query: "...",
  depth: "deep",
  idempotency_key: "deep-research-2026-05-06",
});
```

## TypeScript

Every request and response is fully typed. Import the types you need:

```ts
import type {
  SearchResponse,
  ExtractResponse,
  ResearchBasicResponse,
  ResearchDeepInitResponse,
  ResearchStatusResponse,
  ResearchSseEvent,
} from "brime";
```

The `research()` method is overloaded so the return type narrows automatically based on `depth` and `wait`:

```ts
const r1 = await client.research({ query: "q", depth: "basic" });
//    ^ ResearchBasicResponse

const r2 = await client.research({ query: "q", depth: "deep" });
//    ^ ResearchDeepInitResponse

const r3 = await client.research({ query: "q", depth: "deep", wait: true });
//    ^ ResearchStatusResponse
```

## Configuration reference

| Constructor option | Env var          | Default                |
|--------------------|------------------|------------------------|
| `apiKey`           | `BRIME_API_KEY`  | — (required)           |
| `baseUrl`          | `BRIME_BASE_URL` | `https://api.brime.dev` |
| `timeout`          | —                | `30_000` ms            |

## Drop-in clients for other vendors

Brime exposes wire-compatible adapters under separate paths so the official SDKs work unchanged:

- Tavily — `new TavilyClient({ apiKey, apiBaseUrl: "https://api.brime.dev/tavily" })`
- Exa — `new Exa(apiKey, { baseUrl: "https://api.brime.dev/exa" })`
- Parallel — `new Parallel({ apiKey, baseUrl: "https://api.brime.dev/parallel" })`

Use those when migrating; reach for `brime` (this SDK) when starting fresh or when you want Brime-native ergonomics (deep research, SSE replay, depth presets).

## License

MIT © Brime
