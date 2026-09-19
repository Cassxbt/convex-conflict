import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { searchCompanies, getCompany } from "../shared/companiesHouse";
import { normalizeName } from "../shared/engine";

const key = () => {
  const k = process.env.CH_API_KEY;
  if (!k) throw new Error("CH_API_KEY not set");
  return k;
};

export const cacheEntity = internalMutation({
  args: { companyNumber: v.string(), name: v.string(), status: v.string(), previousNames: v.array(v.object({ name: v.string(), from: v.string(), to: v.string() })) },
  handler: async (ctx, e) => {
    const existing = await ctx.db.query("registryEntities").withIndex("by_companyNumber", (q) => q.eq("companyNumber", e.companyNumber)).first();
    if (existing) await ctx.db.patch(existing._id, { ...e, fetchedAt: Date.now() });
    else await ctx.db.insert("registryEntities", { ...e, fetchedAt: Date.now() });
  },
});

export const getCached = internalQuery({
  args: { companyNumber: v.string() },
  handler: (ctx, { companyNumber }) => ctx.db.query("registryEntities").withIndex("by_companyNumber", (q) => q.eq("companyNumber", companyNumber)).first(),
});

// Resolve one raw name to registry candidates. Exact (normalised) name matches against the
// current or a previous name are candidates; a single exact match resolves, several are
// ambiguous, none is unresolved. Looser search hits are kept as context, not candidates.
export const resolveName = internalAction({
  args: { rawName: v.string(), pinnedCompanyNumber: v.optional(v.string()) },
  handler: async (ctx, { rawName, pinnedCompanyNumber }) => {
    const apiKey = key();
    const wanted = normalizeName(rawName);
    const numbers = new Set<string>();
    if (pinnedCompanyNumber) numbers.add(pinnedCompanyNumber);
    for (const s of await searchCompanies(apiKey, rawName, 10)) numbers.add(s.companyNumber);

    type Cand = { companyNumber: string; name: string; previousNames: string[]; status: string; source: string; primary: boolean; tier: number };
    const candidates: Cand[] = [];
    for (const n of numbers) {
      const e = await getCompany(apiKey, n);
      await ctx.runMutation(internal.registry.cacheEntity, e);
      const current = normalizeName(e.name) === wanted;
      const previous = e.previousNames.some((p) => normalizeName(p.name) === wanted);
      const pinned = n === pinnedCompanyNumber;
      if (!current && !previous && !pinned) continue;
      // Tier 0: the sender's own site named this number. 1: active, current exact name.
      // 2: active, matched only via a previous name. 3: dissolved.
      const tier = pinned ? 0 : e.status !== "active" ? 3 : current ? 1 : 2;
      candidates.push({ companyNumber: e.companyNumber, name: e.name, previousNames: e.previousNames.map((p) => p.name), status: e.status, source: pinned ? "website" : "registry", primary: false, tier });
    }
    candidates.sort((a, b) => a.tier - b.tier);
    const best = candidates[0]?.tier;
    const top = candidates.filter((c) => c.tier === best && best < 3);
    let resolution: "resolved" | "ambiguous" | "unresolved" = "unresolved";
    if (top.length === 1) { top[0].primary = true; resolution = "resolved"; }
    else if (candidates.length > 0) resolution = "ambiguous";
    return { rawName, resolution, candidates, searched: numbers.size };
  },
});
