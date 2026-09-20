import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { decide, normalizeName, type MatterParty, type ProspectParty } from "../shared/engine";

export const workflow = new WorkflowManager(components.workflow);

const FREE_MAIL = new Set(["example.com", "example.org", "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "aol.com"]);

// EXTRACT -> EXPAND -> COMPARE -> HOLD / CLEAR. Every step is a Convex function so the run
// survives restarts and every intermediate result is a row a judge can open.
export const intake = workflow
  .define({ args: { prospectId: v.id("prospects") } })
  .handler(async (step, { prospectId }): Promise<void> => {
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

    const decision = await step.runMutation(internal.intake.decideAndRecord, { prospectId, matterType: extracted.matterType, summary: extracted.summary });
    await step.runMutation(internal.letters.sendOutcome, { prospectId, verdictId: decision.verdictId });
  });

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
  args: { prospectId: v.id("prospects"), matterType: v.string(), summary: v.string() },
  handler: async (ctx, { prospectId, matterType, summary }) => {
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

    const d = decide(parties, matterParties);
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

export const startIntake = internalMutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    await workflow.start(ctx, internal.intake.intake, { prospectId });
  },
});
