import { useState } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, Building2, ExternalLink, Globe, Hash, Lock, ScrollText, ShieldCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fmtTime } from "../lib/route";
import { Empty, Role, Stage, Verdict } from "../components/ui";

function readKey() { try { return sessionStorage.getItem("cc-staff-key") ?? ""; } catch { return ""; } }

export function Record({ id }: { id: Id<"prospects"> }) {
  const [staffKey, setStaffKey] = useState(readKey);
  const [draft, setDraft] = useState("");
  const rec = useQuery(api.demo.record, { prospectId: id, staffKey: staffKey || undefined });
  if (rec === undefined) return <Empty>Loading…</Empty>;
  if (rec === null) return <Empty>No such record.</Empty>;
  const { prospect, parties, verdict, matters } = rec;
  const restricted = rec.access === "restricted";
  const unlock = () => { try { sessionStorage.setItem("cc-staff-key", draft); } catch {} setStaffKey(draft); };
  const matterById = new Map(matters.map((m) => [m!._id, m!]));
  const inFlight = !verdict;

  return (
    <div className="record">
      <a href="#/app" className="back"><ArrowLeft size={14} strokeWidth={2} aria-hidden />Intake</a>

      <header className="dossier-head">
        <div>
          <span className="meta">Instruction</span>
          <h1>{prospect.subject ?? "(no subject)"}</h1>
          <p className="lede"><span className="from">{prospect.from}</span> · {fmtTime(prospect.receivedAt)}</p>
        </div>
        <div className="dossier-state">{verdict ? <Verdict v={verdict.verdict} size="lg" /> : <Stage stage={prospect.stage} />}</div>
      </header>

      {restricted ? (
        <section className="panel restricted">
          <div className="row">
            <p><Lock size={14} strokeWidth={2} aria-hidden /> This instruction arrived by email and may concern a real person. The message, subject, thread, unresolved names, reasons and letter are withheld without the staff passphrase. Registered-company candidates and the verdict are shown because they are public register data.</p>
            <form className="unlock" onSubmit={(e) => { e.preventDefault(); unlock(); }}>
              <input type="password" placeholder="Staff passphrase" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" aria-label="Staff passphrase" />
              <button type="submit" className="btn outline inline">Unlock</button>
            </form>
          </div>
          {staffKey && <p className="field-error">That passphrase did not unlock this record.</p>}
        </section>
      ) : (
        <section className="panel quote-panel">
          <blockquote>{prospect.body}</blockquote>
          <span className="meta">thread <span className="mono">{prospect.threadId}</span></span>
        </section>
      )}

      <section className="panel" aria-labelledby="parties-h">
        <div className="panel-head row">
          <h2 id="parties-h"><Building2 size={16} strokeWidth={1.75} aria-hidden />Parties</h2>
          <span className="meta">extract → expand</span>
        </div>
        {parties.length === 0 ? (
          <Empty>{inFlight ? "Reading the instruction…" : "No parties recorded."}</Empty>
        ) : parties.map((p) => (
          <article key={p._id} className="party appear">
            <div className="party-head">
              <h3>{p.rawName}</h3>
              <span className={`side ${p.side}`}>{p.side}</span>
              <span className={`res ${p.resolution}`}>{p.resolution}</span>
            </div>
            {p.candidates.length === 0 ? (
              <p className="fine">No registry entity matched this name exactly.</p>
            ) : (
              <ul className="cands">
                {p.candidates.map((c) => (
                  <li key={c.companyNumber} className={c.primary ? "primary" : ""}>
                    <span className="cand-line">
                      <Hash size={13} strokeWidth={2} aria-hidden /><span className="mono">{c.companyNumber}</span>
                      <span className="cand-name">{c.name}</span>
                      <span className="meta">{c.primary ? "resolved" : "alternate"} · {c.source}</span>
                    </span>
                    {c.previousNames.length > 0 && <span className="prev">previously {c.previousNames.join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            )}
            {p.evidence.map((e, i) => (
              <figure key={i} className="evidence">
                <figcaption>
                  <Globe size={13} strokeWidth={2} aria-hidden />
                  <a href={e.url} target="_blank" rel="noreferrer">{e.url}<ExternalLink size={11} strokeWidth={2} aria-hidden /></a>
                  <span className="meta">{fmtTime(e.fetchedAt)}</span>
                </figcaption>
                <pre>{e.snippet.trim()}</pre>
              </figure>
            ))}
          </article>
        ))}
      </section>

      {verdict ? (
        <section className="band readout appear" aria-labelledby="verdict-h">
          <div className="band-head">
            <h2 id="verdict-h"><ShieldCheck size={14} strokeWidth={2} aria-hidden />Verdict</h2>
            <span className="meta">compare → {verdict.verdict === "CLEAR" ? "clear" : "hold"}</span>
          </div>
          <div className="readout-grid">
            <dl className="readout-meta">
              <div><dt>rule set</dt><dd className="mono">{verdict.ruleVersion}</dd></div>
              <div><dt>decided</dt><dd className="mono">{fmtTime(verdict.decidedAt)}</dd></div>
              <div><dt>searched</dt><dd>{verdict.searchedParties.join(" · ")}</dd></div>
              <div><dt>matter type</dt><dd>{verdict.matterType}</dd></div>
              {verdict.outboundMessageId && <div><dt>sent</dt><dd className="mono">{verdict.outboundMessageId}</dd></div>}
            </dl>
            <ol className="reasons">{verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}</ol>
          </div>
          {verdict.hits.length > 0 && (
            <table className="grid dark">
              <thead><tr><th>History party</th><th>Role</th><th>Matter</th><th>Via</th></tr></thead>
              <tbody>{verdict.hits.map((h, i) => {
                const m = matterById.get(h.matterId);
                return <tr key={i}><td>{h.matchedName}</td><td><Role r={h.matchedRole} /></td><td className="mono">{m ? `${m.ref} · ${m.title} · ${m.status}` : h.matterId}</td><td>{h.via}</td></tr>;
              })}</tbody>
            </table>
          )}
          {verdict.reviewer && <p className="reviewed">Reviewed by <b>{verdict.reviewer}</b> · {verdict.reviewerNote}{verdict.reviewedAt && <span className="mono"> · {fmtTime(verdict.reviewedAt)}</span>}</p>}
        </section>
      ) : (
        <section className="band readout" aria-live="polite">
          <div className="band-head"><h2><ShieldCheck size={14} strokeWidth={2} aria-hidden />Verdict</h2><span className="meta">{prospect.stage}</span></div>
          <p className="band-empty">Resolving parties against the registry and the firm's history…</p>
        </section>
      )}

      {verdict?.letterText && (
        <section className="panel" aria-labelledby="letter-h">
          <div className="panel-head row">
            <h2 id="letter-h"><ScrollText size={16} strokeWidth={1.75} aria-hidden />{verdict.verdict === "CLEAR" ? "Engagement draft" : "Hold notice"}</h2>
            <span className="meta">{verdict.outboundMessageId ? "sent in thread" : "demo · recorded, not sent"}</span>
          </div>
          <pre className="letter">{verdict.letterText}</pre>
        </section>
      )}
    </div>
  );
}
