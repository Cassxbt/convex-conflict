import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Judge path: paste an instruction, watch the same workflow run, read the record. Nothing is
// emailed; the letter that would have gone out is stored on the verdict.
export const submit = mutation({
  args: { from: v.string(), subject: v.optional(v.string()), body: v.string() },
  handler: async (ctx, { from, subject, body }) => {
    const senderDomain = from.includes("@") ? from.split("@").pop()!.replace(/>$/, "").toLowerCase() : undefined;
    const prospectId = await ctx.db.insert("prospects", {
      inboxId: "demo",
      threadId: `demo-${Date.now()}`,
      messageId: `demo-${Date.now()}`,
      from, senderDomain, subject, body,
      receivedAt: Date.now(),
      stage: "received",
    });
    await ctx.scheduler.runAfter(0, internal.intake.startIntake, { prospectId });
    return prospectId;
  },
});

export const record = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) return null;
    const parties = await ctx.db.query("prospectParties").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).collect();
    const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).first();
    const matters = verdict ? await Promise.all([...new Set(verdict.hits.map((h) => h.matterId))].map((id) => ctx.db.get(id))) : [];
    return { prospect, parties, verdict, matters: matters.filter(Boolean) };
  },
});
