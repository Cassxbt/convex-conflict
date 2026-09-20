import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { publicSender } from "./board";

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

// Console records are fictional and fully public. A record that arrived by email may concern a
// real person: without the staff passphrase the caller gets a projection with the body, subject,
// thread, raw names, reasons and letter withheld; registered-company candidates stay, because
// they are public register data.
export const record = query({
  args: { prospectId: v.id("prospects"), staffKey: v.optional(v.string()) },
  handler: async (ctx, { prospectId, staffKey }) => {
    const prospect = await ctx.db.get(prospectId);
    if (!prospect) return null;
    const parties = await ctx.db.query("prospectParties").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).collect();
    const verdict = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).first();
    const matters = verdict ? await Promise.all([...new Set(verdict.hits.map((h) => h.matterId))].map((id) => ctx.db.get(id))) : [];
    const isEmail = prospect.inboxId !== "demo";
    const unlocked = !isEmail || (!!process.env.STAFF_KEY && staffKey === process.env.STAFF_KEY);
    if (unlocked) return { access: "full" as const, prospect, parties, verdict: verdict ? { ...verdict, hitCount: verdict.hits.length } : null, matters: matters.filter(Boolean) };
    return {
      access: "restricted" as const,
      prospect: { ...prospect, from: publicSender(prospect.from, prospect.inboxId), subject: "(arrived by email)", body: "", threadId: "", messageId: "" },
      parties: parties.map((p) => ({ ...p, rawName: p.resolution === "resolved" ? p.rawName : "(withheld)", evidence: [] })),
      verdict: verdict ? {
        ...verdict,
        reasons: [`${verdict.reasons.length} reason${verdict.reasons.length === 1 ? "" : "s"} on file`],
        hits: [],
        hitCount: verdict.hits.length,
        searchedParties: parties.filter((p) => p.resolution === "resolved").map((p) => p.rawName),
        matterType: "(withheld)",
        summary: "",
        letterText: undefined,
        reviewerNote: undefined,
      } : null,
      matters: [],
    };
  },
});
