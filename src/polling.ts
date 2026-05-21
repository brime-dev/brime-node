/**
 * Research deep-mode polling helper.
 *
 * Poll a status fetcher until the job reaches a terminal state
 * (complete | errored | timeout) or the poll budget is exhausted.
 * Exponential backoff capped at maxIntervalSec.
 */

import { BrimeError } from "./errors.js";
import type { ResearchStatusResponse } from "./types.js";

const TERMINAL: ReadonlySet<ResearchStatusResponse["status"]> = new Set([
  "complete",
  "errored",
  "timeout",
]);

export class PollTimeoutError extends BrimeError {
  constructor(message: string) {
    super(message, { status: 0, code: "poll_timeout" });
  }
}

export interface PollOptions {
  /** Initial seconds between polls. */
  initialIntervalSec: number;
  /** Cap for exponential backoff (seconds). */
  maxIntervalSec: number;
  /** Total budget across all polls (seconds). */
  pollTimeoutSec: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function pollUntilTerminal(
  fetchStatus: () => Promise<ResearchStatusResponse>,
  opts: PollOptions,
): Promise<ResearchStatusResponse> {
  const start = Date.now();
  const deadlineMs = start + opts.pollTimeoutSec * 1000;
  let intervalSec = opts.initialIntervalSec;

  while (true) {
    const status = await fetchStatus();
    if (TERMINAL.has(status.status)) return status;

    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      throw new PollTimeoutError(
        `research polling exceeded ${opts.pollTimeoutSec}s ` +
          `(last status: ${status.status}, round ${status.current_round}/${status.max_rounds})`,
      );
    }
    const sleepMs = Math.min(intervalSec * 1000, remainingMs);
    await sleep(sleepMs);
    intervalSec = Math.min(intervalSec * 1.5, opts.maxIntervalSec);
  }
}
