import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  BrimeError,
  InsufficientCreditsError,
  InternalError,
  InvalidRequestError,
  NotFoundError,
  RateLimitError,
  UpstreamError,
  exceptionFromResponse,
} from "../../src/errors.js";

describe("exceptionFromResponse", () => {
  const cases: [number, string, typeof BrimeError][] = [
    [401, "unauthorized", AuthenticationError],
    [429, "rate_limited", RateLimitError],
    [402, "insufficient_credits", InsufficientCreditsError],
    [400, "invalid_request", InvalidRequestError],
    [404, "not_found", NotFoundError],
    [502, "upstream_error", UpstreamError],
    [500, "internal_error", InternalError],
  ];

  for (const [status, code, Cls] of cases) {
    it(`maps ${status}/${code} → ${Cls.name}`, () => {
      const e = exceptionFromResponse(status, { error: { code, message: "x" } });
      expect(e).toBeInstanceOf(Cls);
      expect(e).toBeInstanceOf(BrimeError);
      expect(e.status).toBe(status);
      expect(e.code).toBe(code);
    });
  }

  it("falls back by status when body is missing", () => {
    const e = exceptionFromResponse(401, null);
    expect(e).toBeInstanceOf(AuthenticationError);
    expect(e.code).toBe("unauthorized");
  });

  it("falls back to InternalError for unknown codes", () => {
    const e = exceptionFromResponse(500, { error: { code: "weird_code", message: "x" } });
    expect(e).toBeInstanceOf(InternalError);
    expect(e.code).toBe("weird_code");
  });
});
