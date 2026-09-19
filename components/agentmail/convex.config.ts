import { defineComponent } from "convex/server";
import { v } from "convex/values";
import workpool from "@convex-dev/workpool/convex.config";

// Vendored from @agentmail/convex 0.1.0 (Apache-2.0) with one change: the component
// declares its env so a typed app (defineApp({ env })) can pass AGENTMAIL_* in. Upstream
// declares none and only inherits env when the app leaves env untyped, which conflicts
// with @firecrawl/firecrawl-convex, whose component requires typed env.
const component = defineComponent("agentmail", {
  env: {
    AGENTMAIL_API_KEY: v.string(),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
    AGENTMAIL_BASE_URL: v.optional(v.string()),
  },
});
component.use(workpool, { name: "sendPool" });
component.use(workpool, { name: "callbackPool" });

export default component;
