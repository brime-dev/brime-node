import { describe, expect, it } from "vitest";

import { iterSse } from "../../src/sse.js";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(ctrl) {
      if (i >= chunks.length) {
        ctrl.close();
        return;
      }
      ctrl.enqueue(enc.encode(chunks[i]!));
      i++;
    },
  });
}

async function collect(s: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const evt of iterSse(s)) out.push(evt);
  return out;
}

describe("iterSse", () => {
  it("parses well-formed multi-event stream", async () => {
    const chunks = [
      "event: tool_call\ndata: {\"round\":1}\n\n",
      "event: tool_result\ndata: {\"count\":5}\n\n",
      "event: complete\ndata: {\"answer\":\"hi\"}\n\n",
    ];
    const events = await collect(streamFrom(chunks));
    expect(events.map((e) => e.event)).toEqual([
      "tool_call",
      "tool_result",
      "complete",
    ]);
  });

  it("handles fragmented chunks", async () => {
    const chunks = [
      "event: status\nda",
      "ta: {\"msg\":\"running\"}",
      "\n\nevent: complete\ndata: {\"x\":1}\n\n",
    ];
    const events = await collect(streamFrom(chunks));
    expect(events.length).toBe(2);
    expect(events[0]!.event).toBe("status");
    expect(events[0]!.data).toEqual({ msg: "running" });
    expect(events[1]!.event).toBe("complete");
  });

  it("stops at [DONE] terminator", async () => {
    const chunks = [
      "event: tool_call\ndata: {\"a\":1}\n\n",
      "data: [DONE]\n\n",
      "event: never\ndata: {}\n\n",
    ];
    const events = await collect(streamFrom(chunks));
    expect(events.length).toBe(1);
    expect(events[0]!.event).toBe("tool_call");
  });

  it("supports id field and multiline data (spec-compliant)", async () => {
    const chunks = [
      'id: 42\nevent: sources\ndata: {"sources":[\ndata:   {"url":"http://a"}\ndata: ]}\n\n',
    ];
    const events = await collect(streamFrom(chunks));
    expect(events[0]!.id).toBe("42");
    const data = events[0]!.data as { sources: { url: string }[] };
    expect(data.sources[0]!.url).toBe("http://a");
  });

  it("falls back to string data for non-JSON payloads", async () => {
    const chunks = ["event: status\ndata: Round 1: thinking…\n\n"];
    const events = await collect(streamFrom(chunks));
    expect(events[0]!.data).toBe("Round 1: thinking…");
  });
});
