import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Remove a prospect and everything hanging off it. Internal only; used for stray records.
export const deleteProspect = internalMutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    for (const p of await ctx.db.query("prospectParties").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).collect()) await ctx.db.delete(p._id);
    for (const vd of await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).collect()) await ctx.db.delete(vd._id);
    await ctx.db.delete(prospectId);
  },
});
