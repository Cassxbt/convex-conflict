import { useQuery } from "convex/react";
import { ArrowRight, CircleCheck, CircleDashed, FileSearch } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { fmtTime } from "../lib/route";
import { Verdict } from "../components/ui";

type Check = { label: string; state: "verified" | "reported" | "not_here"; note: string };

// Four states, and two are neither pass nor fail. A check this page did not run is listed as
// such, so an unavailable check can never be mistaken for a pass.
function StateTag({ s }: { s: Check["state"] }) {
  const text = s === "verified" ? "VERIFIED HERE" : s === "reported" ? "REPORTED, NOT VERIFIED HERE" : "NOT PRESENT HERE";
  return <span className={`check ${s}`}>{text}</span>;
}

export function Proof() {
  const stats = useQuery(api.board.stats);
  const rows = useQuery(api.board.proofList);

  const checks: Check[] = stats ? [
    { label: "Live on convex.site, production deployment", state: "verified", note: "this page is served by the deployment it describes; every number on it is a live query" },
    { label: `${stats.screened} instructions screened, ${stats.realInbound} arrived by email`, state: "verified", note: "prospects table; a row is counted as email when its inbox id is the case inbox rather than the console, which is how the signed webhook handler writes it" },
    { label: `${stats.previousNames} previous names expanded across ${stats.entities} registry entities`, state: "verified", note: "registryEntities table, populated by Companies House API calls made during screens" },
    { label: `${stats.sent} letters handed to AgentMail on the original email thread`, state: stats.sent > 0 ? "verified" : "not_here", note: stats.sent > 0 ? "outbound ids stored on the verdict when the reply is queued; delivery status lives in the AgentMail component's outbound table and is not recomputed here" : "no email-originated record has completed yet; console records are never sent" },
    { label: `${stats.reviewed} partner reviews recorded beside a verdict`, state: stats.reviewed > 0 ? "verified" : "not_here", note: "reviewer, note and time on the verdict row; the engine's verdict is never overwritten" },
    { label: "Deterministic engine, 16 tests", state: "reported", note: "shared/engine.ts and test/engine.test.ts in the repository; this page does not run the suite" },
    { label: "Firecrawl changes entity resolution on a real brand site", state: "reported", note: "scripts/preflight-gate.ts runs the deployed Firecrawl action on thewhiskyexchange.com and compares the number it finds with the register's keyword result; this page does not run it" },
  ] : [];

  return (
    <div className="proof">
      <header className="panel-head">
        <span className="meta">Proof</span>
        <h1>Read the records. No login needed.</h1>
        <p className="lede">Every row below is a real record on this deployment. Open a console record to see the parties, the register candidates, the website evidence, the verdict reasons and the letter. A record that arrived by email shows its verdict and registered candidates only, unless unlocked with the staff passphrase.</p>
      </header>

      {stats && (
        <div className="stat-row">
          <div className="stat"><span className="meta">screened</span><b className="mono">{stats.screened}</b></div>
          <div className="stat"><span className="meta">clear</span><b className="mono">{stats.byVerdict.CLEAR}</b></div>
          <div className="stat"><span className="meta">conflict</span><b className="mono">{stats.byVerdict.CONFLICT}</b></div>
          <div className="stat"><span className="meta">needs review</span><b className="mono">{stats.byVerdict.NEEDS_REVIEW}</b></div>
          <div className="stat"><span className="meta">by email</span><b className="mono">{stats.realInbound}</b></div>
          <div className="stat"><span className="meta">last decided</span><b className="mono small">{stats.lastDecidedAt ? fmtTime(stats.lastDecidedAt) : "—"}</b></div>
        </div>
      )}

      <section className="band">
        <div className="band-head"><h2><FileSearch size={14} strokeWidth={2} aria-hidden />Each stage has run, and says how it is known</h2><span className="meta">current {stats?.ruleVersion}{stats && stats.ruleVersionsOnFile.length > 1 ? ` · on file: ${stats.ruleVersionsOnFile.join(", ")}` : ""}</span></div>
        <table className="grid dark checks">
          <tbody>{checks.map((c) => <tr key={c.label}><td>{c.label}</td><td><StateTag s={c.state} /></td><td className="muted-dark">{c.note}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-head row"><h2>All records</h2><span className="meta">{rows ? `${rows.length} rows` : ""}</span></div>
        {!rows ? <p className="empty">Loading…</p> : rows.length === 0 ? <p className="empty">Nothing screened yet.</p> : (
          <table className="grid">
            <thead><tr><th>Received</th><th>Channel</th><th>Sender domain</th><th>Subject</th><th>Verdict</th><th>Evidence</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.prospectId}>
                <td className="mono">{fmtTime(r.receivedAt)}</td>
                <td><span className="tag">{r.channel}</span></td>
                <td className="mono">{r.senderDomain}</td>
                <td>{r.subject ?? "—"}</td>
                <td>{r.verdict ? <Verdict v={r.verdict} /> : <span className="meta">{r.stage}</span>}</td>
                <td className="evi">
                  {r.previousNameHop && <span className="tag">previous-name hop</span>}
                  {r.websiteEvidence && <span className="tag">website evidence</span>}
                  {r.sent && <span className="tag">sent</span>}
                  {r.reviewed && <span className="tag">reviewed</span>}
                  {r.hits > 0 && <span className="tag">{r.hits} hit{r.hits === 1 ? "" : "s"}</span>}
                </td>
                <td><a className="rowlink" href={`#/record/${r.prospectId}`}>Open<ArrowRight size={13} strokeWidth={2} aria-hidden /></a></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>What these pages are not</h2>
        <ul className="plain">
          <li><CircleCheck size={14} strokeWidth={2} aria-hidden /> A record marked <b>console</b> was pasted into the intake form; it ran the identical workflow but its letter was recorded, not sent.</li>
          <li><CircleCheck size={14} strokeWidth={2} aria-hidden /> Records that arrived by email are shown by sender domain, with the message, names, reasons and letter withheld unless the record is unlocked with the staff passphrase. Console records are fictional and open.</li>
          <li><CircleDashed size={14} strokeWidth={2} aria-hidden /> "Reported, not verified here" means the repository asserts it and this page did not recompute it. It is listed so it cannot be mistaken for a pass.</li>
        </ul>
      </section>
    </div>
  );
}
