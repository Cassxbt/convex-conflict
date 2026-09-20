import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, components } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { agentmail } from "./email";

const http = httpRouter();

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  // @agentmail/convex 0.1.0 types predate convex 1.46 runMutation options; runtime-compatible.
  handler: httpAction(async (ctx, req) => agentmail.handleWebhook(ctx as any, req)),
});

// A judge can curl this. Same numbers as the proof page, same live queries, no login.
http.route({
  path: "/api/proof",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const stats = await ctx.runQuery(api.board.stats, {});
    const records = await ctx.runQuery(api.board.proofList, {});
    return new Response(JSON.stringify({ live: true, ...stats, records: records.map((r) => ({ id: r.prospectId, channel: r.channel, senderDomain: r.senderDomain, verdict: r.verdict, ruleVersion: r.ruleVersion, hits: r.hits, previousNameHop: r.previousNameHop, websiteEvidence: r.websiteEvidence, sent: r.sent })) }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" },
    });
  }),
});

// Static site catch-all last; exact routes above win.
registerStaticRoutes(http, components.staticHosting);

export default http;
