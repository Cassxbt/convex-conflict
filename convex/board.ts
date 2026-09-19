import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Everything the two boards need, one subscription each. Intake sees every prospect and
// its stage; the partner queue is the subset the engine refused to clear on its own.
export const listProspects = query({
  args: {},
  handler: async (ctx) => {
    const prospects = await ctx.db.query("prospects").order("desc").take(50);
    return Promise.all(prospects.map(async (p) => {
      const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).first();
      return {
        _id: p._id,
        from: p.from,
        subject: p.subject,
        receivedAt: p.receivedAt,
        stage: p.stage,
        demo: p.inboxId === "demo",
        verdict: verdict?.verdict ?? null,
        reviewer: verdict?.reviewer ?? null,
        matterType: verdict?.matterType ?? null,
      };
    }));
  },
});

export const reviewQueue = query({
  args: {},
  handler: async (ctx) => {
    const decided = await ctx.db.query("prospects").withIndex("by_stage", (q) => q.eq("stage", "decided")).collect();
    const rows = await Promise.all(decided.map(async (p) => {
      const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).first();
      return verdict && verdict.verdict !== "CLEAR" ? { prospectId: p._id, from: p.from, subject: p.subject, verdict: verdict.verdict, reasons: verdict.reasons, decidedAt: verdict.decidedAt } : null;
    }));
    return rows.filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => a.decidedAt - b.decidedAt);
  },
});

export const matters = query({
  args: {},
  handler: async (ctx) => {
    const ms = await ctx.db.query("matters").collect();
    return Promise.all(ms.map(async (m) => ({
      ...m,
      parties: await ctx.db.query("matterParties").withIndex("by_matter", (q) => q.eq("matterId", m._id)).collect(),
    })));
  },
});

// The solicitor's decision is the record of record. The engine's verdict is never
// overwritten; the review sits beside it with a name, a note and a time.
export const review = mutation({
  args: {
    prospectId: v.id("prospects"),
    reviewer: v.string(),
    decision: v.union(v.literal("confirm_hold"), v.literal("decline"), v.literal("proceed_with_consent")),
    note: v.string(),
  },
  handler: async (ctx, { prospectId, reviewer, decision, note }) => {
    const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).first();
    if (!verdict) throw new Error("no verdict to review");
    await ctx.db.patch(verdict._id, { reviewer, reviewedAt: Date.now(), reviewerNote: `${decision}: ${note}` });
    await ctx.db.patch(prospectId, { stage: "reviewed" });
  },
});
