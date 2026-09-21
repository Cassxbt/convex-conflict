import { Workpool } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { screen } from "./intake";
import { RULE_VERSION } from "../shared/engine";

// A screen is only as current as the matter history it ran against. A matter opened after
// the screen can turn a CLEAR into a conflict, so unreviewed records are re-screened nightly.
// The pool keeps the sweep from competing with live intake for scheduler time.
const pool = new Workpool(components.workpool, { maxParallelism: 2 });

const SEVERITY = { CLEAR: 0, NEEDS_REVIEW: 1, CONFLICT: 2 } as const;

export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const verdicts = await ctx.db.query("verdicts").collect();
    const pending = verdicts.filter((v) => !v.reviewer);
    for (const v of pending) await pool.enqueueMutation(ctx, internal.recheck.rescreen, { verdictId: v._id });
    return { queued: pending.length };
  },
});

// Only an unreviewed record moves, and only towards a hold: a solicitor's decision stands, and
// the register never lifts a hold on its own. New hits and reasons are appended, never replaced,
// so the original screen stays readable on the record.
export const rescreen = internalMutation({
  args: { verdictId: v.id("verdicts") },
  handler: async (ctx, { verdictId }) => {
    const existing = await ctx.db.get(verdictId);
    if (!existing || existing.reviewer) return;
    const d = await screen(ctx, existing.prospectId, {});
    // Same matter, party and role is the same hit even if a newer rule set words `via` differently.
    const key = (h: { matterId: string; matchedName: string; matchedRole: string }) => `${h.matterId}:${h.matchedName}:${h.matchedRole}`;
    const known = new Set(existing.hits.map(key));
    const newHits = d.hits.filter((h) => !known.has(key(h)));
    const stricter = SEVERITY[d.verdict] > SEVERITY[existing.verdict];
    const now = Date.now();
    if (newHits.length === 0 && !stricter) {
      await ctx.db.patch(verdictId, { rescreenedAt: now });
      return;
    }
    const newReasons = d.reasons.filter((r) => !existing.reasons.includes(r));
    await ctx.db.patch(verdictId, {
      rescreenedAt: now,
      rescreenNote: `Re-screened ${existing.ruleVersion === RULE_VERSION ? "against the matter history" : `under ${RULE_VERSION} (originally ${existing.ruleVersion})`} on ${new Date(now).toISOString().slice(0, 10)}: ${newHits.length} new history match${newHits.length === 1 ? "" : "es"}${stricter ? `, verdict raised from ${existing.verdict}` : ""}.`,
      ...(stricter ? { verdict: d.verdict, originalVerdict: existing.originalVerdict ?? existing.verdict } : {}),
      hits: [...existing.hits, ...newHits.map((h) => ({ prospectPartyId: h.prospectPartyId as Id<"prospectParties">, matterId: h.matterId as Id<"matters">, matchedName: h.matchedName, matchedRole: h.matchedRole, via: h.via }))],
      reasons: [...existing.reasons, ...newReasons],
    });
  },
});
