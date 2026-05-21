/**
 * Brime client — single async class covering search, extract, research,
 * polling, and streaming.
 */

import {
  DEEP_RESEARCH_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  buildHeaders,
  decodeResponse,
  newIdempotencyKey,
  resolveApiKey,
  resolveBaseUrl,
  timedFetch,
} from "./http.js";
import { InternalError } from "./errors.js";
import { pollUntilTerminal } from "./polling.js";
import { iterSse } from "./sse.js";
import type {
  BrimeClientOptions,
  ExtractInput,
  ExtractResponse,
  ResearchBasicResponse,
  ResearchDeepInitResponse,
  ResearchInput,
  ResearchSseEvent,
  ResearchStatusResponse,
  SearchInput,
  SearchResponse,
} from "./types.js";

export class Brime {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: BrimeClientOptions = {}) {
    this.apiKey = resolveApiKey(opts.apiKey);
    this.baseUrl = resolveBaseUrl(opts.baseUrl);
    this.timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async search(input: SearchInput): Promise<SearchResponse> {
    return this.postJson<SearchInput, SearchResponse>("/v1/search", input);
  }

  // ── Extract ────────────────────────────────────────────────────────────

  async extract(
    input: ExtractInput,
    opts?: { idempotencyKey?: string; timeout?: number },
  ): Promise<ExtractResponse> {
    const urls = Array.isArray(input.urls) ? input.urls : [input.urls];
    const body: ExtractInput = { ...input, urls };
    return this.postJson<ExtractInput, ExtractResponse>("/v1/extract", body, {
      idempotencyKey: opts?.idempotencyKey ?? newIdempotencyKey(),
      timeoutMs: opts?.timeout ?? DEEP_RESEARCH_TIMEOUT_MS,
    });
  }

  // ── Research ───────────────────────────────────────────────────────────

  /** Overload: depth="basic" */
  async research(
    input: ResearchInput & { depth?: "basic" },
  ): Promise<ResearchBasicResponse>;
  /** Overload: depth="deep", wait=true → terminal status */
  async research(
    input: ResearchInput & { depth: "deep"; wait: true },
  ): Promise<ResearchStatusResponse>;
  /** Overload: depth="deep", wait=false (default) → init response */
  async research(
    input: ResearchInput & { depth: "deep"; wait?: false },
  ): Promise<ResearchDeepInitResponse>;
  async research(
    input: ResearchInput,
  ): Promise<
    ResearchBasicResponse | ResearchDeepInitResponse | ResearchStatusResponse
  > {
    const depth = input.depth ?? "basic";
    const isDeep = depth === "deep";
    const body: Record<string, unknown> = { ...input, depth };
    delete body.wait;
    delete body.poll_interval;
    delete body.max_poll_interval;
    delete body.poll_timeout;
    delete body.idempotency_key;

    const idemKey =
      input.idempotency_key ?? (isDeep ? newIdempotencyKey() : undefined);

    const data = await this.postJson<unknown, unknown>("/v1/research", body, {
      idempotencyKey: idemKey,
      timeoutMs: isDeep ? this.timeoutMs : DEEP_RESEARCH_TIMEOUT_MS,
    });

    if (!isDeep) return data as ResearchBasicResponse;

    const init = data as ResearchDeepInitResponse;
    if (input.wait !== true) return init;

    return pollUntilTerminal(() => this.researchStatus(init.job_id), {
      initialIntervalSec: input.poll_interval ?? 5,
      maxIntervalSec: input.max_poll_interval ?? 30,
      pollTimeoutSec: input.poll_timeout ?? 600,
    });
  }

  async researchStatus(jobId: string): Promise<ResearchStatusResponse> {
    return this.getJson<ResearchStatusResponse>(
      `/v1/research/${encodeURIComponent(jobId)}`,
    );
  }

  /**
   * Stream research events.
   *
   * For depth="deep" (default), we initiate a job first, then connect to
   * its stream URL. For depth="basic", the POST itself returns SSE.
   */
  async *researchStream(
    input: ResearchInput & { last_event_id?: string },
  ): AsyncGenerator<ResearchSseEvent, void, void> {
    const depth = input.depth ?? "deep";
    const lastEventId = input.last_event_id;

    if (depth === "basic") {
      const body: Record<string, unknown> = { ...input, depth: "basic", stream: true };
      delete body.wait;
      delete body.poll_interval;
      delete body.max_poll_interval;
      delete body.poll_timeout;
      delete body.idempotency_key;
      delete body.last_event_id;
      yield* this.streamPost("/v1/research", body, lastEventId);
      return;
    }

    // deep: kick off then attach to stream URL
    const init = await this.research({ ...input, depth: "deep", wait: false });
    yield* this.streamGet(init.stream_url, lastEventId);
  }

  // ── Internal HTTP plumbing ────────────────────────────────────────────

  private async postJson<TIn, TOut>(
    path: string,
    body: TIn,
    opts?: { idempotencyKey?: string; timeoutMs?: number },
  ): Promise<TOut> {
    const headers = buildHeaders(this.apiKey, {
      idempotencyKey: opts?.idempotencyKey,
    });
    const res = await timedFetch(
      `${this.baseUrl}${path}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      opts?.timeoutMs ?? this.timeoutMs,
    );
    return decodeResponse<TOut>(res);
  }

  private async getJson<TOut>(path: string, timeoutMs?: number): Promise<TOut> {
    const headers = buildHeaders(this.apiKey, { jsonBody: false });
    const res = await timedFetch(
      `${this.baseUrl}${path}`,
      { method: "GET", headers },
      timeoutMs ?? this.timeoutMs,
    );
    return decodeResponse<TOut>(res);
  }

  private async *streamPost(
    path: string,
    body: unknown,
    lastEventId?: string,
  ): AsyncGenerator<ResearchSseEvent, void, void> {
    const extra: Record<string, string> = {};
    if (lastEventId) extra["last-event-id"] = lastEventId;
    const headers = buildHeaders(this.apiKey, {
      accept: "text/event-stream",
      extra,
    });
    const res = await timedFetch(
      `${this.baseUrl}${path}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      DEEP_RESEARCH_TIMEOUT_MS,
    );
    if (!res.ok) {
      await decodeResponse(res); // throws BrimeError
      return;
    }
    if (!res.body) {
      throw new InternalError("response has no body for SSE", {
        status: res.status,
        code: "internal_error",
      });
    }
    yield* iterSse(res.body);
  }

  private async *streamGet(
    path: string,
    lastEventId?: string,
  ): AsyncGenerator<ResearchSseEvent, void, void> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const extra: Record<string, string> = {};
    if (lastEventId) extra["last-event-id"] = lastEventId;
    const headers = buildHeaders(this.apiKey, {
      jsonBody: false,
      accept: "text/event-stream",
      extra,
    });
    const res = await timedFetch(
      url,
      { method: "GET", headers },
      DEEP_RESEARCH_TIMEOUT_MS,
    );
    if (!res.ok) {
      await decodeResponse(res);
      return;
    }
    if (!res.body) {
      throw new InternalError("response has no body for SSE", {
        status: res.status,
        code: "internal_error",
      });
    }
    yield* iterSse(res.body);
  }
}

/** Alias kept for parity with the Python SDK / common naming. */
export const BrimeClient = Brime;
