import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, normalizeName, unextractedNames, type MatterParty, type ProspectParty } from "../shared/engine.ts";

const matters: MatterParty[] = [
  { matterId: "m1", matterRef: "HV-2019-001", name: "Royal Mail plc", role: "former_client", companyNumber: "08680755" },
  { matterId: "m1", matterRef: "HV-2019-001", name: "Universal PPE Ltd", role: "adverse" },
  { matterId: "m3", matterRef: "HV-2021-014", name: "Ocado Retail Limited", role: "former_client", companyNumber: "03875000" },
  { matterId: "m5", matterRef: "HV-2018-009", name: "Timpson Group plc", role: "former_client", companyNumber: "02339274" },
  { matterId: "m6", matterRef: "HV-2017-022", name: "Northline Logistics Ltd", role: "former_client" },
  { matterId: "m6", matterRef: "HV-2017-022", name: "Royal Mail plc", role: "adverse", companyNumber: "08680755" },
  { matterId: "m12", matterRef: "HV-2022-031", name: "Timpson Limited", role: "adverse", companyNumber: "00675216" },
];

const ids = (companyNumber: string, name: string, previousNames: string[] = [], primary = true) => ({ companyNumber, name, previousNames, source: "registry", primary });

test("normalizeName strips suffixes and punctuation", () => {
  assert.equal(normalizeName("Royal Mail plc"), "ROYAL MAIL");
  assert.equal(normalizeName("INTERNATIONAL DISTRIBUTION SERVICES LIMITED"), "INTERNATIONAL DISTRIBUTION SERVICES");
  assert.equal(normalizeName("The Whisky Exchange Ltd."), "WHISKY EXCHANGE");
});

test("CLEAR: prospect is a former client, adverse party unknown to the firm", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Ocado Retail", side: "prospect", resolution: "resolved", candidates: [ids("03875000", "OCADO RETAIL LIMITED", ["OCADO LIMITED"])] },
    { id: "p2", rawName: "Halden Cold Chain Ltd", side: "adverse", resolution: "resolved", candidates: [ids("99999999", "HALDEN COLD CHAIN LTD")] },
  ];
  const d = decide(parties, matters);
  assert.equal(d.verdict, "CLEAR");
  assert.equal(d.hits.length, 1);
  assert.equal(d.hits[0].matchedRole, "former_client");
});

test("CONFLICT: adverse party is a former client under a previous name", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Universal PPE", side: "prospect", resolution: "unresolved", candidates: [] },
    { id: "p2", rawName: "International Distribution Services", side: "adverse", resolution: "resolved",
      candidates: [ids("08680755", "INTERNATIONAL DISTRIBUTION SERVICES LIMITED", ["INTERNATIONAL DISTRIBUTION SERVICES PLC", "ROYAL MAIL PLC", "ROYAL MAIL LIMITED"])] },
  ];
  const d = decide(parties, matters);
  assert.equal(d.verdict, "CONFLICT");
  assert.ok(d.hits.some((h) => h.matterId === "m1" && h.matchedRole === "former_client"));
  assert.ok(d.reasons.some((r) => r.includes("company number 08680755") || r.includes("previous name")));
});

test("CONFLICT beats NEEDS_REVIEW when another party is unresolved", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Somebody", side: "prospect", resolution: "unresolved", candidates: [] },
    { id: "p2", rawName: "Royal Mail", side: "adverse", resolution: "resolved", candidates: [ids("08680755", "INTERNATIONAL DISTRIBUTION SERVICES LIMITED", ["ROYAL MAIL PLC"])] },
  ];
  assert.equal(decide(parties, matters).verdict, "CONFLICT");
});

test("NEEDS_REVIEW: resolved name whose alternate entity is a former client", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "a franchisee", side: "prospect", resolution: "unresolved", candidates: [] },
    { id: "p2", rawName: "Timpson", side: "adverse", resolution: "resolved", candidates: [
      ids("00675216", "TIMPSON LIMITED", ["SHOE CARE CENTRES LIMITED"]),
      ids("02339274", "TIMPSON GROUP LIMITED", ["TIMPSON GROUP PLC", "TIMPSON PUBLIC LIMITED COMPANY"], false),
      ids("00323208", "SANDYMERE LIMITED", ["TIMPSON LIMITED"], false),
    ] },
  ];
  const d = decide(parties, matters);
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.hits.some((h) => h.matterId === "m5"), "surfaces the former-client candidate");
  assert.ok(d.reasons.some((r) => r.includes("similarly named entity")));
});

test("NEEDS_REVIEW: nothing resolves, never CLEAR", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Acme Widgets of Slough", side: "adverse", resolution: "unresolved", candidates: [] },
  ];
  assert.equal(decide(parties, matters).verdict, "NEEDS_REVIEW");
  assert.equal(decide([], matters).verdict, "NEEDS_REVIEW");
});

test("prospect-side former adverse party is a CONFLICT", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Timpson Limited", side: "prospect", resolution: "resolved", candidates: [ids("00675216", "TIMPSON LIMITED")] },
  ];
  assert.equal(decide(parties, matters).verdict, "CONFLICT");
});

test("NEEDS_REVIEW: genuinely ambiguous name (no primary)", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Currys", side: "adverse", resolution: "ambiguous", candidates: [
      ids("07105905", "CURRYS PLC", ["DIXONS CARPHONE PLC"], false),
      ids("00504877", "CURRYS GROUP LIMITED", ["DSG RETAIL LIMITED"], false),
    ] },
  ];
  const d = decide(parties, matters);
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.reasons.some((r) => r.includes("2 registry entities")));
});

test("NEEDS_REVIEW: a former client extracted on the 'other' side never clears", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Acme Ltd", side: "prospect", resolution: "resolved", candidates: [ids("99999998", "ACME LTD")] },
    { id: "p2", rawName: "Royal Mail", side: "other", resolution: "resolved", candidates: [ids("08680755", "INTERNATIONAL DISTRIBUTION SERVICES LIMITED", ["ROYAL MAIL PLC"])] },
  ];
  const d = decide(parties, matters);
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.reasons.some((r) => r.includes("other")));
});

test("NEEDS_REVIEW, not CONFLICT: name matches but company numbers differ", () => {
  // Current Royal Mail Limited (14240638) vs the history's Royal Mail plc (08680755)
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Royal Mail", side: "adverse", resolution: "resolved", candidates: [ids("14240638", "ROYAL MAIL LIMITED", ["RM 2022 LIMITED"])] },
  ];
  const d = decide(parties, matters);
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.hits.every((h) => h.via.includes("different company number")));
});

test("NEEDS_REVIEW: a company-shaped name in the email that extraction missed", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Ocado Retail", side: "prospect", resolution: "resolved", candidates: [ids("03875000", "OCADO RETAIL LIMITED")] },
  ];
  const d = decide(parties, matters, { unextracted: ["Reed Boardall Cold Storage Limited"] });
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.reasons.some((r) => r.includes("not extracted")));
});

test("NEEDS_REVIEW: sender site could not be read", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Ocado Retail", side: "prospect", resolution: "resolved", candidates: [ids("03875000", "OCADO RETAIL LIMITED")] },
  ];
  const d = decide(parties, matters, { senderSiteUnavailable: "ocado.invalid" });
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.reasons.some((r) => r.includes("could not be read")));
});

test("NEEDS_REVIEW: similar names in history that no candidate matched", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Sandhurst Bakery", side: "adverse", resolution: "unresolved", candidates: [] },
  ];
  const d = decide(parties, matters, { similar: [{ prospectPartyId: "p1", matchedName: "Sandhurst Bakeries Ltd", matterRef: "HV-2026-011", role: "client" }] });
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.reasons.some((r) => r.includes("similar")));
});

test("unextractedNames finds a suffixed company the model dropped, and does not double count", () => {
  const body = "Ocado Retail wants to instruct you against Reed Boardall Cold Storage Limited and Halden Cold Chain Ltd.\n\nLegal team, Ocado Retail Limited";
  assert.deepEqual(unextractedNames(body, ["Ocado Retail", "Reed Boardall Cold Storage Limited"]), ["Halden Cold Chain Ltd"]);
  assert.deepEqual(unextractedNames("Please sue North Haven Logistics Limited.", ["North Haven Ltd"]), ["North Haven Logistics Limited"]);
  assert.deepEqual(unextractedNames(body, ["Ocado Retail Limited", "Reed Boardall Cold Storage Limited", "Halden Cold Chain Ltd"]), []);
});

test("unextractedNames does not let a short extracted name hide a distinct longer one", () => {
  const body = "We act for Ocado Limited and want to sue Ocado Technology Limited.";
  assert.deepEqual(unextractedNames(body, ["Ocado"]), ["Ocado Technology Limited"]);
});

test("NEEDS_REVIEW: sender site read but no registered number found", () => {
  const parties: ProspectParty[] = [
    { id: "p1", rawName: "Ocado Retail", side: "prospect", resolution: "resolved", candidates: [ids("03875000", "OCADO RETAIL LIMITED")] },
  ];
  const d = decide(parties, matters, { senderSiteNoNumber: "ocado.com" });
  assert.equal(d.verdict, "NEEDS_REVIEW");
  assert.ok(d.reasons.some((r) => r.includes("names no registered company number")));
});
