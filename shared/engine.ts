// Deterministic conflict verdict. No model, no I/O. Everything a verdict depends on is in
// the inputs, so the same inputs always yield the same verdict and hits.

export const RULE_VERSION = "cc-rules-v1";

export type Role = "client" | "former_client" | "adverse" | "related";
export type Verdict = "CLEAR" | "CONFLICT" | "NEEDS_REVIEW";

export type Candidate = {
  companyNumber: string;
  name: string;
  previousNames: string[];
  source: string;
  // The entity the name resolved to. Alternates are kept so a former client hiding behind
  // a similar or previous name is surfaced for review instead of silently dropped.
  primary: boolean;
};

export type ProspectParty = {
  id: string;
  rawName: string;
  side: "prospect" | "adverse" | "other";
  resolution: "resolved" | "ambiguous" | "unresolved";
  candidates: Candidate[];
};

export type MatterParty = {
  matterId: string;
  matterRef: string;
  name: string;
  role: Role;
  companyNumber?: string;
};

export type Hit = {
  prospectPartyId: string;
  candidateNumber?: string;
  matterId: string;
  matchedName: string;
  matchedRole: Role;
  via: string;
};

export type Decision = {
  verdict: Verdict;
  hits: Hit[];
  reasons: string[];
  ruleVersion: string;
};

const SUFFIXES = /\b(PUBLIC LIMITED COMPANY|LIMITED LIABILITY PARTNERSHIP|LIMITED|LTD|PLC|LLP|INC|CO)\b\.?/g;

export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\bTHE\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesOf(c: Candidate): string[] {
  return [c.name, ...c.previousNames].map(normalizeName).filter(Boolean);
}

// A prospect-side entity that the firm once acted against, or an adverse-side entity that
// is or was a client, is a conflict (SRA 6.2/6.5, ABA 1.7/1.9). "related" never conflicts
// on its own; it surfaces for review.
function conflicts(side: ProspectParty["side"], role: Role): boolean {
  if (side === "prospect") return role === "adverse";
  if (side === "adverse") return role === "client" || role === "former_client";
  return false;
}

function matchesFor(party: ProspectParty, candidate: Candidate, matters: MatterParty[]): Hit[] {
  const hits: Hit[] = [];
  const aliases = namesOf(candidate);
  for (const mp of matters) {
    let via: string | null = null;
    if (mp.companyNumber && mp.companyNumber === candidate.companyNumber) {
      const renamed = normalizeName(mp.name) !== normalizeName(candidate.name);
      via = renamed
        ? `company number ${candidate.companyNumber}: recorded as ${mp.name}, now ${candidate.name}`
        : `company number ${candidate.companyNumber}`;
    } else {
      const mpName = normalizeName(mp.name);
      if (mpName && aliases.includes(mpName)) {
        via = mpName === normalizeName(candidate.name)
          ? `name ${candidate.name}`
          : `previous name ${mp.name} of ${candidate.name} (${candidate.companyNumber})`;
      }
    }
    if (via) hits.push({ prospectPartyId: party.id, candidateNumber: candidate.companyNumber, matterId: mp.matterId, matchedName: mp.name, matchedRole: mp.role, via });
  }
  return hits;
}

export function decide(parties: ProspectParty[], matters: MatterParty[]): Decision {
  const reasons: string[] = [];
  const hits: Hit[] = [];
  let needsReview = false;
  let conflict = false;

  if (parties.length === 0) {
    return { verdict: "NEEDS_REVIEW", hits, reasons: ["no parties were extracted from the instruction"], ruleVersion: RULE_VERSION };
  }

  for (const p of parties) {
    if (p.resolution === "unresolved" || p.candidates.length === 0) {
      needsReview = true;
      reasons.push(`"${p.rawName}" did not resolve to a registry entity`);
      // Still search the raw name so a person or trading name with history is surfaced.
      const raw = normalizeName(p.rawName);
      for (const mp of matters) {
        if (raw && normalizeName(mp.name) === raw) {
          hits.push({ prospectPartyId: p.id, matterId: mp.matterId, matchedName: mp.name, matchedRole: mp.role, via: `raw name ${p.rawName}` });
        }
      }
      continue;
    }

    const perCandidate = p.candidates.map((c) => ({ c, hits: matchesFor(p, c, matters) }));
    const allHits = perCandidate.flatMap((x) => x.hits);
    hits.push(...allHits);

    if (p.resolution === "ambiguous") {
      needsReview = true;
      reasons.push(`"${p.rawName}" matches ${p.candidates.length} registry entities: ${p.candidates.map((c) => `${c.name} (${c.companyNumber})`).join(", ")}`);
      continue;
    }

    const primaryNumber = p.candidates.find((c) => c.primary)?.companyNumber;
    for (const h of allHits) {
      const viaAlternate = primaryNumber !== undefined && h.candidateNumber !== primaryNumber;
      if (viaAlternate && conflicts(p.side, h.matchedRole)) {
        needsReview = true;
        reasons.push(`"${p.rawName}" resolved to ${primaryNumber}, but a similarly named entity is ${h.matchedRole.replace("_", " ")} in matter ${matterRef(matters, h.matterId)} via ${h.via}`);
      } else if (conflicts(p.side, h.matchedRole)) {
        conflict = true;
        reasons.push(`"${p.rawName}" (${p.side} side) is ${h.matchedRole.replace("_", " ")} in matter ${matterRef(matters, h.matterId)} via ${h.via}`);
      } else if (h.matchedRole === "related") {
        needsReview = true;
        reasons.push(`"${p.rawName}" is a related party in matter ${matterRef(matters, h.matterId)}`);
      }
    }
  }

  const verdict: Verdict = conflict ? "CONFLICT" : needsReview ? "NEEDS_REVIEW" : "CLEAR";
  if (verdict === "CLEAR") reasons.push(`${parties.length} parties resolved; ${hits.length} history matches, none in a conflicting role`);
  return { verdict, hits, reasons, ruleVersion: RULE_VERSION };
}

function matterRef(matters: MatterParty[], matterId: string): string {
  return matters.find((m) => m.matterId === matterId)?.matterRef ?? matterId;
}
