// Deterministic conflict verdict. No model, no I/O. Everything a verdict depends on is in
// the inputs, so the same inputs always yield the same verdict and hits.

export const RULE_VERSION = "cc-rules-v2";

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
  weak?: boolean;
  matterId: string;
  matchedName: string;
  matchedRole: Role;
  via: string;
};

// Signals the workflow gathers outside the party list. Each one alone blocks CLEAR.
export type Context = {
  // Company-shaped names found in the email that extraction did not return.
  unextracted?: string[];
  // The sender's corporate domain could not be read, so the prospect's entity is unpinned.
  senderSiteUnavailable?: string;
  // Full-text hits in the matter history on a raw name that no candidate matched.
  similar?: { prospectPartyId: string; matchedName: string; matterRef: string; role: Role }[];
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
    let weak = false;
    if (mp.companyNumber && mp.companyNumber === candidate.companyNumber) {
      const renamed = normalizeName(mp.name) !== normalizeName(candidate.name);
      via = renamed
        ? `company number ${candidate.companyNumber}: recorded as ${mp.name}, now ${candidate.name}`
        : `company number ${candidate.companyNumber}`;
    } else {
      const mpName = normalizeName(mp.name);
      if (mpName && aliases.includes(mpName)) {
        // A name match between two different registered numbers is a lead, not an identity.
        const differs = !!mp.companyNumber && mp.companyNumber !== candidate.companyNumber;
        via = differs
          ? `name ${mp.name} matches but different company number (${mp.companyNumber} vs ${candidate.companyNumber})`
          : mpName === normalizeName(candidate.name)
            ? `name ${candidate.name}`
            : `previous name ${mp.name} of ${candidate.name} (${candidate.companyNumber})`;
        if (differs) weak = true;
      }
    }
    if (via) hits.push({ prospectPartyId: party.id, candidateNumber: candidate.companyNumber, matterId: mp.matterId, matchedName: mp.name, matchedRole: mp.role, via, weak });
  }
  return hits;
}

export function decide(parties: ProspectParty[], matters: MatterParty[], context: Context = {}): Decision {
  const reasons: string[] = [];
  const hits: Hit[] = [];
  let needsReview = false;
  let conflict = false;

  if (parties.length === 0) {
    return { verdict: "NEEDS_REVIEW", hits, reasons: ["no parties were extracted from the instruction"], ruleVersion: RULE_VERSION };
  }
  for (const name of context.unextracted ?? []) {
    needsReview = true;
    reasons.push(`"${name}" looks like a party in the email but was not extracted`);
  }
  if (context.senderSiteUnavailable) {
    needsReview = true;
    reasons.push(`the sender's site ${context.senderSiteUnavailable} could not be read, so the prospect's entity is unpinned`);
  }
  for (const sim of context.similar ?? []) {
    needsReview = true;
    reasons.push(`history contains a similar name: ${sim.matchedName} (${sim.role.replace("_", " ")} in ${sim.matterRef})`);
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
      reasons.push(p.candidates.length === 1
        ? `"${p.rawName}" matches only ${p.candidates[0].name} (${p.candidates[0].companyNumber}), which is not an active company`
        : `"${p.rawName}" matches ${p.candidates.length} registry entities: ${p.candidates.map((c) => `${c.name} (${c.companyNumber})`).join(", ")}`);
      continue;
    }

    const primaryNumber = p.candidates.find((c) => c.primary)?.companyNumber;
    for (const h of allHits) {
      const viaAlternate = primaryNumber !== undefined && h.candidateNumber !== primaryNumber;
      if (p.side === "other" && h.matchedRole !== "related") {
        needsReview = true;
        reasons.push(`"${p.rawName}" was extracted as an other party but is ${h.matchedRole.replace("_", " ")} in matter ${matterRef(matters, h.matterId)}; its side must be confirmed`);
      } else if (h.weak && conflicts(p.side, h.matchedRole)) {
        needsReview = true;
        reasons.push(`"${p.rawName}" shares a name with ${h.matchedName} (${h.matchedRole.replace("_", " ")} in matter ${matterRef(matters, h.matterId)}) but the registered numbers differ`);
      } else if (viaAlternate && conflicts(p.side, h.matchedRole)) {
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

// Company-shaped names in an email body. Extraction is a model call; this is the deterministic
// check that it did not drop one. Names that are only a person, a trading name, or a company
// without a suffix are outside its reach, and the honesty table says so.
const COMPANY_SHAPED = /\b((?:[A-Z][A-Za-z&'.-]+\s+){0,5}[A-Z][A-Za-z&'.-]+\s+(?:Limited|Ltd\.?|PLC|plc|LLP|Inc\.?))\b/g;
const GENERIC = new Set(["LIMITED", "LTD", "PLC", "LLP", "INC", "GROUP", "HOLDINGS", "SERVICES", "UK", "INTERNATIONAL", "THE", "AND", "OF"]);
function distinct(n: string): string[] { return n.split(" ").filter((t) => t.length >= 3 && !GENERIC.has(t)); }

export function unextractedNames(body: string, extracted: string[]): string[] {
  const seen = extracted.map(normalizeName).filter(Boolean);
  const out: string[] = [];
  for (const m of body.matchAll(COMPANY_SHAPED)) {
    const n = normalizeName(m[1]);
    if (!n) continue;
    // Covered when an extracted name equals it, or when the found name merely extends an extracted
    // name that already carries at least two distinctive words (the same party, written longer).
    const covered = seen.some((e) => e === n || (n.includes(e) && distinct(e).length >= 2) || (e.includes(n) && distinct(n).length >= 2));
    if (covered) continue;
    if (!out.some((o) => normalizeName(o) === n)) out.push(m[1].trim());
  }
  return out;
}
