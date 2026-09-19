import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Roles a party can hold on a firm matter. Former clients and adverse parties are what
// SRA 6.5 / ABA 1.9 conflict checks must catch, so they are first-class.
export const partyRole = v.union(
  v.literal("client"),
  v.literal("former_client"),
  v.literal("adverse"),
  v.literal("related"),
);

export const verdict = v.union(
  v.literal("CLEAR"),
  v.literal("CONFLICT"),
  v.literal("NEEDS_REVIEW"),
);

export default defineSchema({
  matters: defineTable({
    ref: v.string(),
    title: v.string(),
    status: v.union(v.literal("open"), v.literal("closed")),
    closedAt: v.optional(v.number()),
  }).index("by_ref", ["ref"]),

  // One row per (matter, party). companyNumber is the registry anchor when known.
  matterParties: defineTable({
    matterId: v.id("matters"),
    name: v.string(),
    role: partyRole,
    companyNumber: v.optional(v.string()),
  })
    .index("by_matter", ["matterId"])
    .index("by_companyNumber", ["companyNumber"])
    .searchIndex("search_name", { searchField: "name" }),

  // Registry facts cached per company number (Companies House API).
  registryEntities: defineTable({
    companyNumber: v.string(),
    name: v.string(),
    status: v.string(),
    previousNames: v.array(v.object({ name: v.string(), from: v.string(), to: v.string() })),
    fetchedAt: v.number(),
  }).index("by_companyNumber", ["companyNumber"]),

  prospects: defineTable({
    inboxId: v.string(),
    threadId: v.string(),
    messageId: v.string(),
    from: v.string(),
    senderDomain: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.string(),
    receivedAt: v.number(),
    stage: v.union(
      v.literal("received"),
      v.literal("extracting"),
      v.literal("resolving"),
      v.literal("decided"),
      v.literal("reviewed"),
    ),
  })
    .index("by_thread", ["threadId"])
    .index("by_stage", ["stage"]),

  // Every party the email names, with how it was resolved and what evidence backs it.
  prospectParties: defineTable({
    prospectId: v.id("prospects"),
    rawName: v.string(),
    side: v.union(v.literal("prospect"), v.literal("adverse"), v.literal("other")),
    resolution: v.union(
      v.literal("resolved"),
      v.literal("ambiguous"),
      v.literal("unresolved"),
    ),
    candidates: v.array(v.object({ companyNumber: v.string(), name: v.string(), source: v.string() })),
    evidence: v.array(
      v.object({
        kind: v.union(v.literal("registry"), v.literal("website"), v.literal("court_list"), v.literal("press")),
        url: v.string(),
        snippet: v.string(),
        fetchedAt: v.number(),
      }),
    ),
  }).index("by_prospect", ["prospectId"]),

  verdicts: defineTable({
    prospectId: v.id("prospects"),
    verdict,
    ruleVersion: v.string(),
    hits: v.array(
      v.object({
        prospectPartyId: v.id("prospectParties"),
        matterId: v.id("matters"),
        matchedName: v.string(),
        matchedRole: partyRole,
        via: v.string(),
      }),
    ),
    searchedParties: v.array(v.string()),
    decidedAt: v.number(),
    reviewer: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewerNote: v.optional(v.string()),
    outboundMessageId: v.optional(v.string()),
  }).index("by_prospect", ["prospectId"]),
});
