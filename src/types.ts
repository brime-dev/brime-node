/**
 * Public request/response types for the Brime API.
 *
 * Wire format is snake_case (matches the HTTP API and the Python SDK).
 */

// ── Search ────────────────────────────────────────────────────────────────

export type SearchDepth = "instant" | "basic" | "advanced";
export type Topic = "general" | "news" | "finance";
export type TimeRange = "day" | "week" | "month" | "year";
export type IncludeAnswer = boolean | "basic" | "advanced";

export interface SearchInput {
  query: string;
  depth?: SearchDepth;
  topic?: Topic;
  max_results?: number;
  time_range?: TimeRange;
  start_date?: string;
  end_date?: string;
  include_answer?: IncludeAnswer;
  include_images?: boolean;
  domains?: string[];
  exclude_domains?: string[];
}

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number | null;
  published_date?: string | null;
}

export interface SearchResponse {
  query: string;
  answer: string | null;
  results: SearchResultItem[];
  request_id: string;
  credits_used: number;
  latency_ms: number;
}

// ── Extract ───────────────────────────────────────────────────────────────

export interface ExtractInput {
  urls: string | string[];
  include_metadata?: boolean;
  per_url_timeout_ms?: number;
}

export type ExtractMethod =
  | "worker_pdf"
  | "worker_docx"
  | "worker_static"
  | "worker_hydration"
  | "worker_rust_md"
  | "chrome_render";

/**
 * Unified page metadata emitted by `/v1/extract` for every successful
 * extract result. All fields are optional — workers may not be able to
 * derive every field for every URL. The index signature preserves any
 * future fields the server adds without requiring an SDK upgrade.
 */
export interface ExtractMetadata {
  title?: string | null;
  description?: string | null;
  author?: string | null;
  published_date?: string | null;
  canonical?: string | null;
  og_image?: string | null;
  language?: string | null;
  /** Worker phase timings — only present when include_metadata=true. */
  timings?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExtractResultItem {
  url: string;
  markdown: string;
  method: ExtractMethod | string;
  content_type: "pdf" | "docx" | "html" | string;
  status?: number;
  latency_ms?: number;
  render_latency_ms?: number;
  detection?: string;
  metadata?: ExtractMetadata;
}

export interface ExtractFailedItem {
  url: string;
  error: {
    code: string;
    message: string;
    needs_browser?: boolean;
  };
}

export interface ExtractResponse {
  results: ExtractResultItem[];
  failed: ExtractFailedItem[];
  request_id: string;
  credits_used: number;
  latency_ms: number;
}

// ── Research ──────────────────────────────────────────────────────────────

export type ResearchDepth = "basic" | "deep";

export interface ResearchInput {
  query: string;
  depth?: ResearchDepth;
  max_rounds?: number;
  fast?: boolean;
  scrape?: boolean;
  query_gen?: boolean;
  topic?: Topic;
  max_results?: number;
  time_range?: TimeRange;
  /** When depth="deep" and wait=true, block until terminal status. */
  wait?: boolean;
  /** Seconds between status polls (deep mode + wait=true). */
  poll_interval?: number;
  /** Cap interval growth (exponential backoff). */
  max_poll_interval?: number;
  /** Total polling budget in seconds. */
  poll_timeout?: number;
  /** Override auto-generated Idempotency-Key. */
  idempotency_key?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  content?: string;
  score?: number | null;
  published_date?: string | null;
}

export interface ResearchBasicResponse {
  query: string;
  answer: string | null;
  sources: ResearchSource[];
  steps?: unknown[];
  request_id: string;
  credits_used: number;
  latency_ms: number;
}

export interface ResearchDeepInitResponse {
  job_id: string;
  status: "queued";
  status_url: string;
  stream_url: string;
  request_id: string;
  credits_used: number;
  started_at: string;
}

export type ResearchJobStatus =
  | "queued"
  | "running"
  | "complete"
  | "errored"
  | "timeout";

export interface ResearchStatusResponse {
  job_id: string;
  status: ResearchJobStatus;
  current_round: number;
  max_rounds: number;
  query: string;
  depth: ResearchDepth;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  answer: string | null;
  sources_count: number;
  steps_count: number;
  error: { code: string; message: string } | null;
  credits_used: number;
}

/**
 * A single SSE frame from /v1/research stream endpoints.
 *
 * `data` is typically a structured object but may be a free-form string
 * for status events (e.g. "Round 1: thinking…"). Consumers should check
 * `typeof evt.data === "object"` before subscripting.
 */
export interface ResearchSseEvent {
  event: string;
  data: unknown;
  id?: string;
}

// ── Client construction ───────────────────────────────────────────────────

export interface BrimeClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Default per-request timeout in ms. Default 30_000. */
  timeout?: number;
}
