import { WorkflowManager, type WorkflowCtx } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { decide, normalizeName, RULE_VERSION, unextractedNames, type Context, type MatterParty, type ProspectParty } from "../shared/engine";

export const workflow = new WorkflowManager(components.workflow);

const FREE_MAIL = new Set(["example.com", "example.org", "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "aol.com"]);

const STOP = new Set(["AND", "THE", "OF", "GROUP", "HOLDINGS", "SERVICES", "INTERNATIONAL", "UK", "COMPANY", "TRADING", "SOLUTIONS", "LIMITED", "LTD", "PLC", "LLP"]);
function distinctiveTokens(name: string): string[] {
  return normalizeName(name).split(" ").filter((t) => t.length >= 4 && !STOP.has(t));
}
function wouldConflict(side: "prospect" | "adverse" | "other", role: string): boolean {
  if (side === "prospect") return role === "adverse";
  if (side === "adverse") return role === "client" || role === "former_client";
  return role !== "related";
}

// EXTRACT -> EXPAND -> COMPARE -> HOLD / CLEAR. Every step is a Convex function so the run
// survives restarts and every intermediate result is a row a judge can open. Any failure
// inside the loop fails closed: the case is held, never left open or cleared.
export const intake = workflow
  .define({ args: { prospectId: v.id("prospects") } })
  .handler(async (step, { prospectId }): Promise<void> => {
    try {
      await run(step, prospectId);
    } catch (e: any) {
      await step.runMutation(internal.intake.failClosed, { prospectId, error: String(e?.message ?? e).slice(0, 300) });
    }
  });

async function run(step: WorkflowCtx, prospectId: Id<"prospects">): Promise<void> {
    const prospect = await step.runQuery(internal.intake.getProspect, { prospectId });
    if (!prospect) return;

    await step.runMutation(internal.intake.setStage, { prospectId, stage: "extracting" });
    const extracted = await step.runAction(internal.extract.extractParties, {
      from: prospect.from, subject: prospect.subject, body: prospect.body,
    }, { retry: true });

    await step.runMutation(internal.intake.setStage, { prospectId, stage: "resolving" });

    // The sender's own site is the one source the registry cannot give us: brand -> entity.
    const domain = prospect.senderDomain;
    const siteEvidence = domain && !FREE_MAIL.has(domain)
      ? await step.runAction(internal.resolve.brandToEntity, { domain }, { retry: true })
      : [];
    const siteNumber = siteEvidence.find((e) => e.companyNumbers.length > 0)?.companyNumbers[0];
    const corporate = !!domain && !FREE_MAIL.has(domain);
    const siteUnreadable = corporate && (siteEvidence.length === 0 || siteEvidence.every((e) => e.snippet.startsWith("ERROR")));

    // Belt and braces on the model: the same organisation named twice is one party.
    const seen = new Set<string>();
    const parties = extracted.parties.filter((p) => { const k = `${p.side}:${normalizeName(p.name)}`; if (seen.has(k)) return false; seen.add(k); return true; });

    const partyIds: Id<"prospectParties">[] = [];
    for (const party of parties) {
      const pinned = party.side === "prospect" && party.kind === "company" ? siteNumber : undefined;
      const resolved = party.kind === "person"
        ? { rawName: party.name, resolution: "unresolved" as const, candidates: [], searched: 0 }
        : await step.runAction(internal.registry.resolveName, { rawName: party.name, pinnedCompanyNumber: pinned }, { retry: true });
      const evidence = pinned
        ? siteEvidence.filter((e) => e.companyNumbers.includes(pinned)).map((e) => ({ kind: "website" as const, url: e.url, snippet: e.snippet, fetchedAt: e.fetchedAt }))
        : [];
      const id = await step.runMutation(internal.intake.recordParty, {
        prospectId, rawName: party.name, side: party.side, resolution: resolved.resolution,
        candidates: resolved.candidates.map((c) => ({ companyNumber: c.companyNumber, name: c.name, source: c.source, previousNames: c.previousNames, primary: c.primary })),
        evidence,
      });
      partyIds.push(id);
    }

    const decision = await step.runMutation(internal.intake.decideAndRecord, {
      prospectId,
      matterType: extracted.matterType,
      summary: extracted.summary,
      unextracted: unextractedNames(prospect.body, parties.map((p) => p.name)),
      senderSiteUnavailable: siteUnreadable ? domain : undefined,
    });
    await step.runAction(internal.letters.sendOutcome, { prospectId, verdictId: decision.verdictId }, { retry: true });
}

export const getProspect = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: (ctx, { prospectId }) => ctx.db.get(prospectId),
});

export const setStage = internalMutation({
  args: { prospectId: v.id("prospects"), stage: v.union(v.literal("received"), v.literal("extracting"), v.literal("resolving"), v.literal("decided"), v.literal("reviewed")) },
  handler: async (ctx, { prospectId, stage }) => { await ctx.db.patch(prospectId, { stage }); },
});

export const recordParty = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    rawName: v.string(),
    side: v.union(v.literal("prospect"), v.literal("adverse"), v.literal("other")),
    resolution: v.union(v.literal("resolved"), v.literal("ambiguous"), v.literal("unresolved")),
    candidates: v.array(v.object({ companyNumber: v.string(), name: v.string(), source: v.string(), previousNames: v.array(v.string()), primary: v.boolean() })),
    evidence: v.array(v.object({ kind: v.union(v.literal("registry"), v.literal("website"), v.literal("court_list"), v.literal("press")), url: v.string(), snippet: v.string(), fetchedAt: v.number() })),
  },
  handler: (ctx, args) => ctx.db.insert("prospectParties", args),
});

// The verdict is computed inside one mutation over the firm's current history, so the
// record and the state it was decided against are consistent.
export const decideAndRecord = internalMutation({
  args: { prospectId: v.id("prospects"), matterType: v.string(), summary: v.string(), unextracted: v.optional(v.array(v.string())), senderSiteUnavailable: v.optional(v.string()) },
  handler: async (ctx, { prospectId, matterType, summary, unextracted, senderSiteUnavailable }) => {
    const partiesDocs = await ctx.db.query("prospectParties").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).collect();
    const parties: ProspectParty[] = partiesDocs.map((p) => ({
      id: p._id, rawName: p.rawName, side: p.side, resolution: p.resolution,
      candidates: p.candidates.map((c) => ({ companyNumber: c.companyNumber, name: c.name, previousNames: c.previousNames, source: c.source, primary: c.primary })),
    }));

    const matters = await ctx.db.query("matters").collect();
    const refs = new Map(matters.map((m) => [m._id, m.ref]));
    const matterParties: MatterParty[] = (await ctx.db.query("matterParties").collect()).map((mp) => ({
      matterId: mp.matterId, matterRef: refs.get(mp.matterId) ?? mp.matterId, name: mp.name, role: mp.role, companyNumber: mp.companyNumber,
    }));

    // Full-text search over history party names surfaces near-misses no candidate matched.
    // A hit counts only when it shares a distinctive word with the raw name and its role would
    // conflict with the party's side; "Limited" in common is not a lead.
    const similar: Context["similar"] = [];
    for (const p of parties) {
      const core = distinctiveTokens(p.rawName);
      if (core.length === 0) continue;
      const found = await ctx.db.query("matterParties").withSearchIndex("search_name", (q) => q.search("name", core.join(" "))).take(5);
      for (const mp of found) {
        if (!wouldConflict(p.side, mp.role)) continue;
        const shared = distinctiveTokens(mp.name).some((t) => core.includes(t));
        if (!shared) continue;
        const already = parties.some((pp) => pp.candidates.some((c) => c.companyNumber && c.companyNumber === mp.companyNumber))
          || normalizeName(mp.name) === normalizeName(p.rawName)
          || parties.some((pp) => pp.candidates.some((c) => [c.name, ...c.previousNames].map(normalizeName).includes(normalizeName(mp.name))));
        if (!already) similar.push({ prospectPartyId: p.id, matchedName: mp.name, matterRef: refs.get(mp.matterId) ?? mp.matterId, role: mp.role });
      }
    }
    const d = decide(parties, matterParties, { unextracted, senderSiteUnavailable, similar });
    const verdictId = await ctx.db.insert("verdicts", {
      prospectId,
      verdict: d.verdict,
      ruleVersion: d.ruleVersion,
      hits: d.hits.map((h) => ({ prospectPartyId: h.prospectPartyId as Id<"prospectParties">, matterId: h.matterId as Id<"matters">, matchedName: h.matchedName, matchedRole: h.matchedRole, via: h.via })),
      reasons: d.reasons,
      matterType,
      summary,
      searchedParties: parties.map((p) => p.rawName),
      decidedAt: Date.now(),
    });
    await ctx.db.patch(prospectId, { stage: "decided" });
    return { verdictId, verdict: d.verdict };
  },
});

// A screen that could not finish is a hold, with the reason on the record.
export const failClosed = internalMutation({
  args: { prospectId: v.id("prospects"), error: v.string() },
  handler: async (ctx, { prospectId, error }) => {
    const existing = await ctx.db.query("verdicts").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).first();
    if (existing) {
      // The verdict stands; what failed was after it. Record that on the case and try the notice once more.
      await ctx.db.patch(existing._id, { reasons: [...existing.reasons, `outcome step failed after the verdict: ${error}`] });
      if (!existing.outboundMessageId && !existing.letterText) await ctx.scheduler.runAfter(0, internal.letters.sendOutcome, { prospectId, verdictId: existing._id });
      return;
    }
    const parties = await ctx.db.query("prospectParties").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).collect();
    const verdictId = await ctx.db.insert("verdicts", {
      prospectId, verdict: "NEEDS_REVIEW", ruleVersion: RULE_VERSION, hits: [],
      reasons: [`the screen could not be completed: ${error}`],
      matterType: "unknown", summary: "Screen interrupted before a verdict could be computed.",
      searchedParties: parties.map((p) => p.rawName), decidedAt: Date.now(),
    });
    await ctx.db.patch(prospectId, { stage: "decided" });
    await ctx.scheduler.runAfter(0, internal.letters.sendOutcome, { prospectId, verdictId });
  },
});

export const startIntake = internalMutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    await workflow.start(ctx, internal.intake.intake, { prospectId });
  },
});
