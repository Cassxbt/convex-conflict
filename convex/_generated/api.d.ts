/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as board from "../board.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as email from "../email.js";
import type * as extract from "../extract.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as letters from "../letters.js";
import type * as recheck from "../recheck.js";
import type * as registry from "../registry.js";
import type * as resolve from "../resolve.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  board: typeof board;
  crons: typeof crons;
  demo: typeof demo;
  email: typeof email;
  extract: typeof extract;
  http: typeof http;
  intake: typeof intake;
  letters: typeof letters;
  recheck: typeof recheck;
  registry: typeof registry;
  resolve: typeof resolve;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("../../components/agentmail/_generated/component.js").ComponentApi<"agentmail">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  workpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workpool">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
