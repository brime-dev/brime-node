import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Brime, AuthenticationError, InvalidRequestError } from "../../src/index.js";

const realFetch = globalThis.fetch;

interface MockOpts {
  body?: unknown;
  status?: number;
  headers?: Record<string, string>;
  capture?: { url?: string; init?: RequestInit | undefined };
}

function mockFetch(opts: MockOpts | ((url: string, init?: RequestInit) => MockOpts)) {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof url === "string" ? url : url.toString();
    const r = typeof opts === "function" ? opts(u, init) : opts;
    if (r.capture) {
      r.capture.url = u;
      r.capture.init = init;
    }
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {}), {
      status: r.status ?? 200,
      headers: r.headers,
    });
  }) as typeof fetch;
}

beforeEach(() => {
  delete process.env.BRIME_API_KEY;
  delete process.env.BRIME_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Brime constructor", () => {
  it("throws when no api key is provided", () => {
    expect(() => new Brime()).toThrow(/Brime API key not set/);
  });

  it("uses BRIME_API_KEY env fallback", () => {
    process.env.BRIME_API_KEY = "sk-env";
    expect(() => new Brime()).not.toThrow();
  });

  it("strips trailing slash from baseUrl", () => {
    const c = new Brime({ apiKey: "sk-x", baseUrl: "https://example.com/" });
    expect((c as unknown as { baseUrl: string }).baseUrl).toBe("https://example.com");
  });
});

describe("Brime.search", () => {
  it("posts to /v1/search and returns SearchResponse", async () => {
    const cap: MockOpts["capture"] = {};
    mockFetch({
      body: {
        query: "BM25", answer: "a", results: [{ title: "T", url: "http://x", content: "c", score: 0.9 }],
        request_id: "r", credits_used: 1, latency_ms: 50,
      },
      capture: cap,
    });
    const c = new Brime({ apiKey: "sk-test" });
    const res = await c.search({ query: "BM25" });
    expect(res.results.length).toBe(1);
    expect(res.results[0]?.url).toBe("http://x");
    expect(cap.url).toBe("https://api.brime.dev/v1/search");
    expect(cap.init?.method).toBe("POST");
    const sentHeaders = cap.init?.headers as Headers;
    expect(sentHeaders.get("authorization")).toBe("Bearer sk-test");
  });

  it("maps 401 to AuthenticationError", async () => {
    mockFetch({
      status: 401,
      body: { error: { code: "unauthorized", message: "bad key" } },
    });
    const c = new Brime({ apiKey: "sk-bad" });
    await expect(c.search({ query: "q" })).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("maps 400 to InvalidRequestError", async () => {
    mockFetch({
      status: 400,
      body: { error: { code: "invalid_request", message: "empty" } },
    });
    const c = new Brime({ apiKey: "sk-x" });
    await expect(c.search({ query: "" })).rejects.toBeInstanceOf(InvalidRequestError);
  });
});

describe("Brime.extract", () => {
  it("auto-generates Idempotency-Key header", async () => {
    const cap: MockOpts["capture"] = {};
    mockFetch({
      body: { results: [], failed: [], request_id: "r", credits_used: 0, latency_ms: 1 },
      capture: cap,
    });
    const c = new Brime({ apiKey: "sk-x" });
    await c.extract({ urls: "https://example.com" });
    const h = cap.init?.headers as Headers;
    const idem = h.get("idempotency-key");
    expect(idem).toBeTruthy();
    expect(idem!.length).toBeGreaterThan(20);
  });

  it("respects user-supplied idempotency key", async () => {
    const cap: MockOpts["capture"] = {};
    mockFetch({
      body: { results: [], failed: [], request_id: "r", credits_used: 0, latency_ms: 1 },
      capture: cap,
    });
    const c = new Brime({ apiKey: "sk-x" });
    await c.extract({ urls: ["https://x"] }, { idempotencyKey: "my-key" });
    const h = cap.init?.headers as Headers;
    expect(h.get("idempotency-key")).toBe("my-key");
  });

  it("normalizes single-string urls to array in body", async () => {
    const cap: MockOpts["capture"] = {};
    mockFetch({
      body: { results: [], failed: [], request_id: "r", credits_used: 0, latency_ms: 1 },
      capture: cap,
    });
    const c = new Brime({ apiKey: "sk-x" });
    await c.extract({ urls: "https://only" });
    const sent = JSON.parse(cap.init?.body as string);
    expect(sent.urls).toEqual(["https://only"]);
  });

  it("exposes typed metadata fields on result items", async () => {
    mockFetch({
      body: {
        results: [
          {
            url: "https://example.com",
            markdown: "# hi",
            method: "worker_static",
            content_type: "html",
            status: 200,
            latency_ms: 42,
            metadata: {
              title: "Example Domain",
              description: "Illustrative example.",
              author: "IANA",
              published_date: "2024-01-15T00:00:00Z",
              canonical: "https://example.com/",
              og_image: "https://example.com/og.png",
              language: "en",
            },
          },
        ],
        failed: [],
        request_id: "r",
        credits_used: 1,
        latency_ms: 50,
      },
    });
    const c = new Brime({ apiKey: "sk-x" });
    const res = await c.extract({ urls: "https://example.com" });
    const item = res.results[0]!;
    expect(item.metadata?.title).toBe("Example Domain");
    expect(item.metadata?.description).toBe("Illustrative example.");
    expect(item.metadata?.author).toBe("IANA");
    expect(item.metadata?.published_date).toBe("2024-01-15T00:00:00Z");
    expect(item.metadata?.canonical).toBe("https://example.com/");
    expect(item.metadata?.og_image).toBe("https://example.com/og.png");
    expect(item.metadata?.language).toBe("en");
  });
});

describe("Brime.research basic", () => {
  it("returns ResearchBasicResponse", async () => {
    mockFetch({
      body: {
        query: "q", answer: "a",
        sources: [{ title: "S", url: "http://s", content: "c", score: 0.5 }],
        request_id: "r", credits_used: 2, latency_ms: 100,
      },
    });
    const c = new Brime({ apiKey: "sk-x" });
    const res = await c.research({ query: "q", depth: "basic" });
    expect(res.answer).toBe("a");
    expect(res.sources.length).toBe(1);
  });
});

describe("Brime.research deep", () => {
  it("wait=false returns init response and adds Idempotency-Key", async () => {
    const cap: MockOpts["capture"] = {};
    mockFetch({
      status: 202,
      body: {
        job_id: "j", status: "queued",
        status_url: "/v1/research/j", stream_url: "/v1/research/j/stream",
        request_id: "r", credits_used: 5, started_at: "2026-05-06T00:00:00Z",
      },
      capture: cap,
    });
    const c = new Brime({ apiKey: "sk-x" });
    const res = await c.research({ query: "q", depth: "deep" });
    expect(res.job_id).toBe("j");
    expect(res.status).toBe("queued");
    const h = cap.init?.headers as Headers;
    expect(h.get("idempotency-key")).toBeTruthy();
  });

  it("wait=true polls status to complete", async () => {
    let nthCall = 0;
    mockFetch((url) => {
      if (url.endsWith("/v1/research")) {
        return {
          status: 202,
          body: {
            job_id: "j", status: "queued",
            status_url: "/v1/research/j", stream_url: "/v1/research/j/stream",
            request_id: "r", credits_used: 5, started_at: "2026-05-06T00:00:00Z",
          },
        };
      }
      // status polls
      nthCall++;
      const seq = [
        { status: "queued", current_round: 0 },
        { status: "running", current_round: 2 },
        {
          status: "complete", current_round: 5,
          answer: "done", sources_count: 9,
          completed_at: "2026-05-06T00:00:30Z",
        },
      ];
      const s = seq[Math.min(nthCall - 1, seq.length - 1)]!;
      return {
        body: {
          job_id: "j", current_round: 0, max_rounds: 5, query: "q",
          depth: "deep", started_at: "2026-05-06T00:00:00Z",
          updated_at: "2026-05-06T00:00:01Z", completed_at: null, answer: null,
          sources_count: 0, steps_count: 0, error: null, credits_used: 5,
          ...s,
        },
      };
    });
    const c = new Brime({ apiKey: "sk-x" });
    const res = await c.research({
      query: "q", depth: "deep", wait: true,
      poll_interval: 0.01, max_poll_interval: 0.05, poll_timeout: 2,
    });
    expect(res.status).toBe("complete");
    expect(res.answer).toBe("done");
  });
});
