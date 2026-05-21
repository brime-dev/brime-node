/**
 * SSE parser: converts a fetch Response body (ReadableStream<Uint8Array>)
 * into an AsyncGenerator<ResearchSseEvent>.
 *
 * Handles fragmented chunks (a frame may arrive across multiple reads),
 * the `[DONE]` terminator, and SSE-spec multiline data fields.
 */

import type { ResearchSseEvent } from "./types.js";

const DONE_SENTINEL = Symbol("__brime_sse_done__");
type FrameOrDone = ResearchSseEvent | typeof DONE_SENTINEL | null;

function parseFrame(frame: string): FrameOrDone {
  let eventType: string | undefined;
  let eventId: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.length === 0 || line.startsWith(":")) continue;

    const colonIdx = line.indexOf(":");
    let field: string;
    let value: string;
    if (colonIdx >= 0) {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1).replace(/^ /, "");
    } else {
      field = line;
      value = "";
    }

    if (field === "event") eventType = value;
    else if (field === "id") eventId = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0 && eventType === undefined) return null;

  const rawData = dataLines.join("\n");
  if (rawData.trim() === "[DONE]") return DONE_SENTINEL;

  let data: unknown;
  if (rawData.length === 0) {
    data = {};
  } else {
    try {
      data = JSON.parse(rawData);
    } catch {
      data = rawData;
    }
  }

  return { event: eventType ?? "message", data, id: eventId };
}

class SseAccumulator {
  private buf = "";
  private _done = false;

  get done(): boolean {
    return this._done;
  }

  feed(chunk: string): void {
    this.buf += chunk;
  }

  popFrames(): ResearchSseEvent[] {
    const out: ResearchSseEvent[] = [];
    while (true) {
      const idx = this.buf.indexOf("\n\n");
      if (idx < 0) break;
      const frame = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      const parsed = parseFrame(frame);
      if (parsed === null) continue;
      if (parsed === DONE_SENTINEL) {
        this._done = true;
        break;
      }
      out.push(parsed);
    }
    return out;
  }
}

/**
 * Drain a fetch Response body as SSE events. Auto-cancels the underlying
 * reader when the consumer breaks out of the for-await loop.
 */
export async function* iterSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ResearchSseEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const acc = new SseAccumulator();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        acc.feed(decoder.decode(value, { stream: true }));
        for (const evt of acc.popFrames()) yield evt;
        if (acc.done) return;
      }
    }
    // Final flush in case stream ended without trailing \n\n
    acc.feed(decoder.decode());
    for (const evt of acc.popFrames()) yield evt;
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore cancel errors */
    }
  }
}
