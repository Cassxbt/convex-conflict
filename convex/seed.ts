import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Hollin & Vance LLP is fictional; every matter is fictional. Company names and numbers are
// real Companies House records (verified 2026-09-19) so registry expansion has real
// previous names to hit. Roles follow the schema: who we acted for, who we acted against.
type SeedMatter = {
  ref: string;
  title: string;
  status: Doc<"matters">["status"];
  closedAt?: number;
  parties: { name: string; role: Doc<"matterParties">["role"]; companyNumber?: string }[];
};

const y = (year: number) => Date.UTC(year, 5, 30);

export const MATTERS: SeedMatter[] = [
  { ref: "HV-2019-001", title: "Supply-contract dispute", status: "closed", closedAt: y(2021),
    parties: [{ name: "Royal Mail plc", role: "former_client", companyNumber: "08680755" }, { name: "Universal PPE Ltd", role: "adverse" }] },
  { ref: "HV-2022-004", title: "Lease renewal, Quorum Park", status: "closed", closedAt: y(2023),
    parties: [{ name: "Greggs plc", role: "former_client", companyNumber: "00502851" }, { name: "Quorum Park Estates Ltd", role: "adverse" }] },
  { ref: "HV-2021-014", title: "Commercial contracts advice", status: "closed", closedAt: y(2022),
    parties: [{ name: "Ocado Retail Limited", role: "former_client", companyNumber: "03875000" }] },
  { ref: "HV-2019-017", title: "Product liability, group claim", status: "closed", closedAt: y(2020),
    parties: [{ name: "DSG Retail Limited", role: "former_client", companyNumber: "00504877" }] },
  { ref: "HV-2018-009", title: "Group reorganisation", status: "closed", closedAt: y(2019),
    parties: [{ name: "Timpson Group plc", role: "former_client", companyNumber: "02339274" }] },
  { ref: "HV-2017-022", title: "Carriage claim", status: "closed", closedAt: y(2018),
    parties: [{ name: "Northline Logistics Ltd", role: "former_client" }, { name: "Royal Mail plc", role: "adverse", companyNumber: "08680755" }] },
  { ref: "HV-2026-002", title: "Excise duty appeal", status: "open",
    parties: [{ name: "Speciality Drinks Limited", role: "client", companyNumber: "04449145" }, { name: "HMRC", role: "adverse" }] },
  { ref: "HV-2023-030", title: "Consumer dispute", status: "closed", closedAt: y(2024),
    parties: [{ name: "R. Achebe", role: "former_client" }, { name: "Currys plc", role: "adverse", companyNumber: "07105905" }] },
  { ref: "HV-2026-011", title: "Employment, unfair dismissal", status: "open",
    parties: [{ name: "Sandhurst Bakeries Ltd", role: "client" }] },
  { ref: "HV-2020-008", title: "Data-protection advice", status: "closed", closedAt: y(2021),
    parties: [{ name: "Ocado Group plc", role: "former_client", companyNumber: "07098618" }] },
  { ref: "HV-2026-006", title: "Professional negligence, survey", status: "open",
    parties: [{ name: "Mercer Court Homes Ltd", role: "client" }, { name: "Central Surveyors Limited", role: "adverse" }] },
  { ref: "HV-2022-031", title: "Supply dispute", status: "closed", closedAt: y(2022),
    parties: [{ name: "Deacon Print Ltd", role: "former_client" }, { name: "Timpson Limited", role: "adverse", companyNumber: "00675216" }] },
];

export const seedMatters = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    for (const m of MATTERS) {
      const existing = await ctx.db.query("matters").withIndex("by_ref", (q) => q.eq("ref", m.ref)).first();
      if (existing) continue;
      const matterId = await ctx.db.insert("matters", { ref: m.ref, title: m.title, status: m.status, closedAt: m.closedAt });
      for (const p of m.parties) await ctx.db.insert("matterParties", { matterId, ...p });
      inserted++;
    }
    return { inserted, total: MATTERS.length };
  },
});
