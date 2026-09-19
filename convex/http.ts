import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { components } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { agentmail } from "./email";

const http = httpRouter();

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  // @agentmail/convex 0.1.0 types predate convex 1.46 runMutation options; runtime-compatible.
  handler: httpAction(async (ctx, req) => agentmail.handleWebhook(ctx as any, req)),
});

// Static site catch-all last; exact routes above win.
registerStaticRoutes(http, components.staticHosting);

export default http;
