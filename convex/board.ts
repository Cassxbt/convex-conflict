import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { RULE_VERSION } from "../shared/engine";

// Records that arrived by email may belong to a real person. Public surfaces show the sender's
// domain only; console (demo) records are fictional and shown in full.
export function publicSender(from: string, inboxId: string): string {
  if (inboxId === "demo") return from;
  const domain = from.includes("@") ? from.split("@").pop()!.replace(/>$/, "") : "unknown";
  return `[sender at ${domain}]`;
}

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
        from: publicSender(p.from, p.inboxId),
        subject: p.inboxId === "demo" ? p.subject : "(arrived by email)",
        receivedAt: p.receivedAt,
        stage: p.stage,
        demo: p.inboxId === "demo",
        verdict: verdict?.verdict ?? null,
        reviewer: verdict?.reviewer ?? null,
        matterType: p.inboxId === "demo" ? verdict?.matterType ?? null : null,
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
      const email = p.inboxId !== "demo";
      // Every state waits for a recorded decision. CLEAR sent a preliminary letter and needs
      // confirmation; CONFLICT and NEEDS_REVIEW need a resolution.
      return verdict
        ? { prospectId: p._id, from: publicSender(p.from, p.inboxId), email, subject: email ? "(arrived by email)" : p.subject ?? null, verdict: verdict.verdict, reasons: email ? [`${verdict.reasons.length} reasons on file; unlock the record with the staff passphrase`] : verdict.reasons, decidedAt: verdict.decidedAt }
        : null;
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
// Console records are open so a judge can exercise the review. Email-originated records may
// concern a real person and need the staff passphrase (STAFF_KEY on the deployment).
export const review = mutation({
  args: {
    prospectId: v.id("prospects"),
    reviewer: v.string(),
    decision: v.union(v.literal("confirm_hold"), v.literal("decline"), v.literal("proceed_with_consent"), v.literal("confirm_clear")),
    note: v.string(),
    staffKey: v.optional(v.string()),
  },
  handler: async (ctx, { prospectId, reviewer, decision, note, staffKey }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) throw new Error("no such prospect");
    if (prospect.inboxId !== "demo") {
      const expected = process.env.STAFF_KEY;
      if (!expected || staffKey !== expected) throw new Error("This record arrived by email. Reviewing it needs the staff passphrase.");
    }
    if (!reviewer.trim()) throw new Error("reviewer name required");
    const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).first();
    if (!verdict) throw new Error("no verdict to review");
    await ctx.db.patch(verdict._id, { reviewer, reviewedAt: Date.now(), reviewerNote: `${decision}: ${note}` });
    await ctx.db.patch(prospectId, { stage: "reviewed" });
  },
});

// Numbers for the front page and the proof page. Everything here is read live from the
// deployment; nothing is hard-coded, so the page cannot claim more than the database holds.
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const prospects = await ctx.db.query("prospects").collect();
    const verdicts = await ctx.db.query("verdicts").collect();
    const entities = await ctx.db.query("registryEntities").collect();
    const matters = await ctx.db.query("matters").collect();
    const byVerdict = { CLEAR: 0, CONFLICT: 0, NEEDS_REVIEW: 0 } as Record<string, number>;
    for (const v of verdicts) byVerdict[v.verdict]++;
    const real = prospects.filter((p) => p.inboxId !== "demo");
    const sent = verdicts.filter((v) => v.outboundMessageId).length;
    const reviewed = verdicts.filter((v) => v.reviewer).length;
    const previousNames = entities.reduce((n, e) => n + e.previousNames.length, 0);
    const latestConflict = verdicts.filter((v) => v.verdict === "CONFLICT").sort((a, b) => b.decidedAt - a.decidedAt)[0] ?? null;
    return {
      screened: prospects.length,
      realInbound: real.length,
      demo: prospects.length - real.length,
      byVerdict,
      sent,
      reviewed,
      entities: entities.length,
      previousNames,
      matters: matters.length,
      ruleVersion: RULE_VERSION,
      ruleVersionsOnFile: [...new Set(verdicts.map((v) => v.ruleVersion))].sort(),
      latestConflictId: latestConflict?.prospectId ?? null,
      lastDecidedAt: verdicts.length ? Math.max(...verdicts.map((v) => v.decidedAt)) : null,
    };
  },
});

// Public proof listing: every record, its verdict and how it was reached. Sender addresses are
// reduced to their domain because this page needs no login.
export const proofList = query({
  args: {},
  handler: async (ctx) => {
    const prospects = await ctx.db.query("prospects").order("desc").take(100);
    return Promise.all(prospects.map(async (p) => {
      const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).first();
      const parties = await ctx.db.query("prospectParties").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).collect();
      return {
        prospectId: p._id,
        senderDomain: p.senderDomain ?? "unknown",
        channel: p.inboxId === "demo" ? "console" : "email",
        subject: p.inboxId === "demo" ? p.subject ?? null : "(arrived by email)",
        receivedAt: p.receivedAt,
        stage: p.stage,
        verdict: verdict?.verdict ?? null,
        ruleVersion: verdict?.ruleVersion ?? null,
        hits: verdict?.hits.length ?? 0,
        websiteEvidence: parties.some((x) => x.evidence.some((e) => e.kind === "website")),
        previousNameHop: verdict?.hits.some((h) => h.via.includes("previous name") || h.via.includes("recorded as")) ?? false,
        sent: !!verdict?.outboundMessageId,
        reviewed: !!verdict?.reviewer,
      };
    }));
  },
});
