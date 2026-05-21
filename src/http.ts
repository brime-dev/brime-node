/**
 * Internal HTTP layer: fetch wrapper, header builder, response decoder.
 */

import {
  type BrimeErrorBody,
  exceptionFromResponse,
  wrapTransportError,
} from "./errors.js";

export const DEFAULT_BASE_URL = "https://api.brime.dev";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEEP_RESEARCH_TIMEOUT_MS = 600_000;
export const SDK_VERSION = "0.1.0";
export const USER_AGENT = `brime-node/${SDK_VERSION}`;

export function resolveApiKey(apiKey: string | undefined): string {
  if (apiKey && apiKey.length > 0) return apiKey;
  const env = readEnv("BRIME_API_KEY");
  if (env && env.length > 0) return env;
  throw new Error(
    "Brime API key not set. Pass apiKey to the constructor or set BRIME_API_KEY env var.",
  );
}

export function resolveBaseUrl(baseUrl: string | undefined): string {
  if (baseUrl && baseUrl.length > 0) return baseUrl.replace(/\/+$/, "");
  const env = readEnv("BRIME_BASE_URL");
  if (env && env.length > 0) return env.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return proc?.env?.[name];
}

export interface HeaderOptions {
  jsonBody?: boolean;
  idempotencyKey?: string;
  accept?: string;
  extra?: Record<string, string>;
}

export function buildHeaders(apiKey: string, opts: HeaderOptions = {}): Headers {
  const h = new Headers();
  h.set("authorization", `Bearer ${apiKey}`);
  h.set("user-agent", USER_AGENT);
  h.set("accept", opts.accept ?? "application/json");
  if (opts.jsonBody !== false) h.set("content-type", "application/json");
  if (opts.idempotencyKey) h.set("idempotency-key", opts.idempotencyKey);
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) h.set(k.toLowerCase(), v);
  }
  return h;
}

export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `brime-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function decodeResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  const requestId = res.headers.get("x-request-id") ?? undefined;
  if (!res.ok) {
    const errBody = (body && typeof body === "object" ? body : null) as BrimeErrorBody | null;
    throw exceptionFromResponse(res.status, errBody, requestId);
  }
  return body as T;
}

/** Run fetch with AbortController-driven timeout; transport errors → BrimeError. */
export async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (exc) {
    throw wrapTransportError(exc);
  } finally {
    clearTimeout(timer);
  }
}
