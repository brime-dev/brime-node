/**
 * Official Node.js / TypeScript SDK for the Brime API.
 *
 * @example
 * ```ts
 * import { Brime } from "@brime-ai/brime";
 *
 * const client = new Brime({ apiKey: "sk-brime-..." });
 * const result = await client.search({ query: "BM25 ranking" });
 * console.log(result.answer);
 * ```
 */

export { Brime, BrimeClient } from "./client.js";
export {
  AuthenticationError,
  BrimeError,
  InsufficientCreditsError,
  InternalError,
  InvalidRequestError,
  NotFoundError,
  RateLimitError,
  UpstreamError,
} from "./errors.js";
export { PollTimeoutError } from "./polling.js";
export type {
  BrimeClientOptions,
  ExtractFailedItem,
  ExtractInput,
  ExtractMetadata,
  ExtractMethod,
  ExtractResponse,
  ExtractResultItem,
  IncludeAnswer,
  ResearchBasicResponse,
  ResearchDeepInitResponse,
  ResearchDepth,
  ResearchInput,
  ResearchJobStatus,
  ResearchSource,
  ResearchSseEvent,
  ResearchStatusResponse,
  SearchDepth,
  SearchInput,
  SearchResponse,
  SearchResultItem,
  TimeRange,
  Topic,
} from "./types.js";

import { Brime } from "./client.js";

export const VERSION = "0.1.0";

export default Brime;
