# brime

**The live-web toolkit for AI apps.** One API key. One SDK. Search, scrape, and research the open web — clean output, sane defaults, no plumbing.

```bash
npm install @brime-ai/brime
```

Built for Node.js 18+, Bun, Deno, Cloudflare Workers, and modern browsers. Native `fetch`, zero HTTP dependencies, ESM + CJS + full TypeScript types.

## Why brime?

- **One key, three primitives.** `search`, `extract`, `research` — the shape every AI app needs from the web.
- **Tuned defaults.** No depth selectors, no round counters, no knobs to babysit. The gateway is tuned for you; you pass a query, you get a clean answer.
- **Drop-in compatible.** If you're already on Tavily, Exa, or Parallel, point their SDK at our adapter URL and your code keeps working. Migrate when you're ready.
- **Honest pricing.** Flat per-call credits. 0.5 for search, 1 per URL for extract, 5 for research. No surprises.

## 30 seconds

```ts
import { Brime } from "@brime-ai/brime";

const brime = new Brime(); // reads BRIME_API_KEY

// Live answer + ranked sources, sub-second.
const { answer, results } = await brime.search({
  query: "what changed in the latest TypeScript release",
});
console.log(answer);
```

That's the whole shape. Same pattern for `extract` and `research`.

## What you can build

### Search the open web

```ts
const { answer, results } = await brime.search({
  query: "tesla earnings", // any natural-language query
  topic: "finance",        // optional: news / general / finance recency hint
  time_range: "week",      // optional: day / week / month / year
  domains: ["sec.gov"],    // optional allow-list
});
```

### Turn any URL into clean markdown

```ts
const { results, failed } = await brime.extract({
  urls: ["https://example.com", "https://en.wikipedia.org/wiki/BM25"],
});

for (const r of results) console.log(r.url, r.markdown.length);
for (const f of failed) console.warn("skipped", f.url, f.error.message);
```

Handles HTML, PDF, DOCX, and JavaScript-heavy SPAs. Smart-clean pipeline strips chrome, nav, cookie banners, and template noise — what's left is the article.

### Multi-step research with citations

```ts
const { answer, sources } = await brime.research({
  query: "compare frontier coding models with concrete benchmark numbers",
});

console.log(answer);
console.log(`${sources.length} sources cited`);
```

One call, ~30–90 seconds, real synthesis from real sources. Want live progress? Stream it:

```ts
for await (const evt of brime.researchStream({ query: "..." })) {
  console.log(evt.event, evt.data);
  if (evt.event === "complete" || evt.event === "error") break;
}
```

## Authentication

```bash
export BRIME_API_KEY="sk-brime-..."
```

```ts
new Brime();                            // uses BRIME_API_KEY
new Brime({ apiKey: "sk-brime-..." });  // explicit
new Brime({ baseUrl: "https://..." });  // staging override (or BRIME_BASE_URL)
```

Get a key at [brime.dev](https://brime.dev) — the free tier comes with 1,000 credits/month and no card.

## TypeScript

Everything is typed end-to-end:

```ts
import type {
  SearchResponse,
  ExtractResponse,
  ResearchBasicResponse,
  ResearchSseEvent,
} from "@brime-ai/brime";
```

## Error handling

Typed exceptions, predictable surface area:

```ts
import {
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  BrimeError,
} from "@brime-ai/brime";

try {
  await brime.search({ query: "..." });
} catch (e) {
  if (e instanceof AuthenticationError) /* bad key */;
  else if (e instanceof RateLimitError) /* back off */;
  else if (e instanceof InsufficientCreditsError) /* top up */;
  else if (e instanceof BrimeError) console.error(e.code, e.message);
  else throw e;
}
```

## Idempotency, baked in

`extract` calls require an `Idempotency-Key` — the SDK auto-generates one per call so accidental retries never double-charge. Pin it yourself for cross-process dedup:

```ts
await brime.extract(
  { urls: ["https://x"] },
  { idempotencyKey: "user-42-prefetch-2026-05" },
);
```

## Configuration

| Constructor option | Env var          | Default                  |
|--------------------|------------------|--------------------------|
| `apiKey`           | `BRIME_API_KEY`  | — (required)             |
| `baseUrl`          | `BRIME_BASE_URL` | `https://api.brime.dev`  |
| `timeout`          | —                | `30_000` ms              |

## Already using Tavily, Exa, or Parallel?

You don't have to rip them out. Brime exposes wire-compatible adapters:

```ts
new TavilyClient({ apiKey, apiBaseUrl: "https://api.brime.dev/tavily" });
new Exa(apiKey, { baseUrl: "https://api.brime.dev/exa" });
new Parallel({ apiKey, baseUrl: "https://api.brime.dev/parallel" });
```

Same response shapes, same code. Switch to the native `brime` SDK when you want the extras (research synthesis, SSE streaming, smart-clean extract).

## Links

- Docs — [docs.brime.dev](https://docs.brime.dev)
- API reference — [docs.brime.dev/api-reference](https://docs.brime.dev/api-reference)
- Status — [brime.dev](https://brime.dev)
- Issues — [github.com/brime-dev/brime-node/issues](https://github.com/brime-dev/brime-node/issues)

## License

MIT © Brime
