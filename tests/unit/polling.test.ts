import { describe, expect, it } from "vitest";

import { PollTimeoutError, pollUntilTerminal } from "../../src/polling.js";
import type { ResearchStatusResponse } from "../../src/types.js";

function status(s: ResearchStatusResponse["status"], round = 0): ResearchStatusResponse {
  return {
    job_id: "j",
    status: s,
    current_round: round,
    max_rounds: 5,
    query: "q",
    depth: "deep",
    started_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    completed_at: null,
    answer: null,
    sources_count: 0,
    steps_count: 0,
    error: null,
    credits_used: 5,
  };
}

describe("pollUntilTerminal", () => {
  it("returns on terminal complete", async () => {
    const seq = [status("queued"), status("running", 1), status("complete", 5)];
    const fetcher = async (): Promise<ResearchStatusResponse> => seq.shift()!;
    const r = await pollUntilTerminal(fetcher, {
      initialIntervalSec: 0.01,
      maxIntervalSec: 0.05,
      pollTimeoutSec: 2,
    });
    expect(r.status).toBe("complete");
    expect(r.current_round).toBe(5);
  });

  it("returns on terminal errored", async () => {
    const seq = [status("queued"), status("errored", 1)];
    const fetcher = async (): Promise<ResearchStatusResponse> => seq.shift()!;
    const r = await pollUntilTerminal(fetcher, {
      initialIntervalSec: 0.01,
      maxIntervalSec: 0.02,
      pollTimeoutSec: 1,
    });
    expect(r.status).toBe("errored");
  });

  it("throws PollTimeoutError when budget exhausted", async () => {
    const fetcher = async (): Promise<ResearchStatusResponse> => status("running", 2);
    await expect(
      pollUntilTerminal(fetcher, {
        initialIntervalSec: 0.01,
        maxIntervalSec: 0.05,
        pollTimeoutSec: 0.05,
      }),
    ).rejects.toBeInstanceOf(PollTimeoutError);
  });
});
