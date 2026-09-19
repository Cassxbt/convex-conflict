import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, normalizeName, type MatterParty, type ProspectParty } from "../shared/engine.ts";

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
