/**
 * Brime API error hierarchy.
 *
 * Brime native errors come back as:
 *   { error: { code: string, message: string, details?: unknown } }
 */

export class BrimeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    opts: { status: number; code: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = new.target.name;
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.requestId = opts.requestId;
    // Preserve prototype chain across CJS/ESM boundaries.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends BrimeError {}
export class RateLimitError extends BrimeError {}
export class InsufficientCreditsError extends BrimeError {}
export class InvalidRequestError extends BrimeError {}
export class NotFoundError extends BrimeError {}
export class UpstreamError extends BrimeError {}
export class InternalError extends BrimeError {}

/** Network-level failure (DNS, ECONNRESET, TLS, etc.). status=0, code="connection_error". */
export class ConnectionError extends BrimeError {}
/** Request aborted because the configured timeout fired. status=0, code="timeout". */
export class TimeoutError extends BrimeError {}

const CODE_TO_CLASS: Record<string, typeof BrimeError> = {
  unauthorized: AuthenticationError,
  rate_limited: RateLimitError,
  insufficient_credits: InsufficientCreditsError,
  invalid_request: InvalidRequestError,
  not_found: NotFoundError,
  upstream_error: UpstreamError,
  internal_error: InternalError,
};

const FRIENDLY: Record<string, string> = {
  unauthorized:
    "Invalid Brime API key. Check the apiKey option or BRIME_API_KEY env var.",
  rate_limited: "Brime rate limit hit. Wait a moment and retry.",
  insufficient_credits: "Brime account is out of credits for this period.",
  invalid_request: "The request was invalid.",
  not_found: "Resource not found.",
  upstream_error: "Brime upstream service error. Try again shortly.",
  internal_error: "Brime internal error. Try again shortly.",
};

export interface BrimeErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/** Build the appropriate BrimeError subclass from an error response body. */
export function exceptionFromResponse(
  status: number,
  body: BrimeErrorBody | null,
  requestId?: string,
): BrimeError {
  const err = body?.error ?? {};
  let code = err.code;
  let message = err.message;

  if (typeof code !== "string" || code.length === 0) {
    if (status === 401) code = "unauthorized";
    else if (status === 402) code = "insufficient_credits";
    else if (status === 404) code = "not_found";
    else if (status === 429) code = "rate_limited";
    else if (status === 502 || status === 503 || status === 504) code = "upstream_error";
    else if (status >= 400 && status < 500) code = "invalid_request";
    else code = "internal_error";
  }

  if (typeof message !== "string" || message.length === 0) {
    message = FRIENDLY[code] ?? `Brime API error (HTTP ${status})`;
  }

  const Cls = CODE_TO_CLASS[code] ?? InternalError;
  return new Cls(message, { status, code, details: err.details, requestId });
}

/**
 * Build a BrimeError from a transport-level failure. Distinguishes:
 *   - aborted (AbortError / signal aborted) → TimeoutError, when the abort
 *     originated from our timeout signal; otherwise a ConnectionError
 *     ("request aborted")
 *   - everything else (DNS, TLS, ECONNRESET, ...) → ConnectionError
 */
export function wrapTransportError(exc: unknown, opts: { timedOut?: boolean } = {}): BrimeError {
  const msg = exc instanceof Error ? exc.message : String(exc);
  if (opts.timedOut) {
    return new TimeoutError(`request timed out: ${msg}`, {
      status: 0,
      code: "timeout",
    });
  }
  const isAbort =
    exc instanceof Error &&
    (exc.name === "AbortError" || /aborted/i.test(exc.message));
  if (isAbort) {
    return new ConnectionError(`request aborted: ${msg}`, {
      status: 0,
      code: "connection_error",
    });
  }
  return new ConnectionError(`network error: ${msg}`, {
    status: 0,
    code: "connection_error",
  });
}
