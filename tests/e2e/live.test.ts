/**
 * Live e2e gates against a real Brime backend.
 *
 * Requires:
 *   BRIME_API_KEY  — a valid sk-brime-... key
 *   BRIME_BASE_URL — preview/production endpoint (optional; defaults to api.brime.dev)
 *
 * Skipped automatically when BRIME_API_KEY is missing.
 */

import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  Brime,
  InvalidRequestError,
  type ResearchSseEvent,
  type ResearchStatusResponse,
} from "../../src/index.js";

const HAS_KEY = Boolean(process.env.BRIME_API_KEY);
const live = HAS_KEY ? describe : describe.skip;

live("live e2e", () => {
  it("G2 search instant", { timeout: 30_000 }, async () => {
    const c = new Brime();
    const res = await c.search({
      query: "BM25 ranking algorithm",
      depth: "instant",
      max_results: 5,
    });
    expect(res.results.length).toBeGreaterThan(0);
    console.log(
      `  G2 instant: ${res.results.length} results, latency=${res.latency_ms}ms`,
    );
  });

  it("G2 search basic", { timeout: 60_000 }, async () => {
    const c = new Brime();
    const res = await c.search({
      query: "python async io patterns",
      depth: "basic",
      max_results: 5,
    });
    expect(res.results.length).toBeGreaterThan(0);
    console.log(
      `  G2 basic: ${res.results.length} results, ` +
        `answer_len=${(res.answer ?? "").length}, lat=${res.latency_ms}ms`,
    );
  });

  it("G3 extract example.com", { timeout: 60_000 }, async () => {
    const c = new Brime();
    const res = await c.extract({ urls: "https://example.com" });
    expect(res.results.length).toBe(1);
    expect(res.results[0]!.markdown.length).toBeGreaterThan(0);
    console.log(
      `  G3 extract: method=${res.results[0]!.method}, md_len=${res.results[0]!.markdown.length}`,
    );
  });

  it("G4 research basic", { timeout: 120_000 }, async () => {
    const c = new Brime({ timeout: 120_000 });
    const res = await c.research({
      query: "what is BM25",
      depth: "basic",
      max_rounds: 1,
    });
    expect(res.answer).toBeTruthy();
    console.log(
      `  G4 basic: answer_len=${(res.answer ?? "").length}, sources=${res.sources.length}, lat=${res.latency_ms}ms`,
    );
  });

  it("G5 research deep + wait", { timeout: 600_000 }, async () => {
    const c = new Brime({ timeout: 60_000 });
    const res: ResearchStatusResponse = await c.research({
      query: "what is the okapi bm25 formula",
      depth: "deep",
      max_rounds: 2,
      wait: true,
      poll_interval: 8,
      max_poll_interval: 20,
      poll_timeout: 420,
    });
    expect(res.status).toBe("complete");
    console.log(
      `  G5 deep wait: status=${res.status} answer_len=${(res.answer ?? "").length} ` +
        `sources=${res.sources_count} steps=${res.steps_count}`,
    );
  });

  it("G6 research deep + stream", { timeout: 600_000 }, async () => {
    const c = new Brime({ timeout: 60_000 });
    const events: string[] = [];
    let terminal = false;
    for await (const evt of c.researchStream({
      query: "what is BM25 ranking",
      depth: "deep",
      max_rounds: 2,
    }) as AsyncIterable<ResearchSseEvent>) {
      events.push(evt.event);
      if (evt.event === "complete" || evt.event === "error" || evt.event === "timeout") {
        terminal = true;
        break;
      }
    }
    console.log(`  G6 deep stream: events=${events.slice(0, 8).join(",")}... total=${events.length}`);
    expect(terminal).toBe(true);
  });

  it("G7 bad-key → AuthenticationError", { timeout: 30_000 }, async () => {
    const c = new Brime({ apiKey: "sk-brime-totally-fake-key" });
    await expect(c.search({ query: "x" })).rejects.toBeInstanceOf(AuthenticationError);
    console.log("  G7 bad key OK");
  });

  it("G7 empty-query → InvalidRequestError", { timeout: 30_000 }, async () => {
    const c = new Brime();
    await expect(c.search({ query: "" })).rejects.toBeInstanceOf(InvalidRequestError);
    console.log("  G7 empty query OK");
  });
});
