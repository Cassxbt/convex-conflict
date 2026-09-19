import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Route = { view: "intake" } | { view: "review" } | { view: "record"; id: Id<"prospects"> } | { view: "matters" };

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("record/")) return { view: "record", id: h.slice(7) as Id<"prospects"> };
  if (h === "review") return { view: "review" };
  if (h === "matters") return { view: "matters" };
  return { view: "intake" };
}

function useRoute() {
  const [route, setRoute] = useState<Route>(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

const FIXTURES = [
  { label: "CLEAR", from: "legal@ocado.com", subject: "Chilled logistics contract", body: "Ocado Retail wants to instruct you against our supplier Reed Boardall Cold Storage Limited over a chilled-logistics contract.\n\nLegal team, Ocado Retail Limited" },
  { label: "CONFLICT", from: "legal@universalppe.co.uk", subject: "Cancelled supply contract", body: "We want to instruct you to sue International Distribution Services Limited over a cancelled supply contract.\n\nRegards, Universal PPE Ltd" },
  { label: "NEEDS_REVIEW", from: "dan.okafor@gmail.com", subject: "Franchise claim", body: "I am a franchisee and want to bring a claim against Timpson for breach of the franchise agreement.\n\nDan Okafor" },
];

export default function App() {
  const route = useRoute();
  const queue = useQuery(api.board.reviewQueue);
  return (
    <div className="shell">
      <header className="top">
        <a href="#/" className="brand">Conflict Clear <span>Hollin &amp; Vance LLP · intake</span></a>
        <nav>
          <a href="#/" className={route.view === "intake" ? "on" : ""}>Intake</a>
          <a href="#/review" className={route.view === "review" ? "on" : ""}>Partner review{queue && queue.length > 0 ? <b>{queue.length}</b> : null}</a>
          <a href="#/matters" className={route.view === "matters" ? "on" : ""}>Matter history</a>
        </nav>
      </header>
      <main>
        {route.view === "intake" && <Intake />}
        {route.view === "review" && <Review />}
        {route.view === "record" && <Record id={route.id} />}
        {route.view === "matters" && <Matters />}
      </main>
      <footer className="notice">
        Conflict Clear is a screening aid. It searches, expands and records; it does not decide. A supervising solicitor reviews every outcome, and CONFLICT and NEEDS_REVIEW never send an engagement letter.
      </footer>
    </div>
  );
}

function Intake() {
  const rows = useQuery(api.board.listProspects);
  const submit = useMutation(api.demo.submit);
  const [from, setFrom] = useState(FIXTURES[1].from);
  const [subject, setSubject] = useState(FIXTURES[1].subject);
  const [body, setBody] = useState(FIXTURES[1].body);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const id = await submit({ from, subject, body });
      window.location.hash = `#/record/${id}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two">
      <section className="card">
        <h2>Screen an instruction</h2>
        <p className="muted">Prospects email <code>conflictclear@agentmail.to</code>. Paste one here to run the same screen without sending anything.</p>
        <div className="chips">
          {FIXTURES.map((f) => (
            <button key={f.label} className={`chip ${f.label.toLowerCase()}`} onClick={() => { setFrom(f.from); setSubject(f.subject); setBody(f.body); }}>{f.label} example</button>
          ))}
        </div>
        <label>From<input value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label>Email<textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <button className="primary" disabled={busy || !body.trim()} onClick={send}>{busy ? "Starting…" : "Run conflict screen"}</button>
      </section>
      <section className="card">
        <h2>Intake board</h2>
        {!rows ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="muted">Nothing received yet.</p> : (
          <table>
            <thead><tr><th>Received</th><th>From</th><th>Subject</th><th>Stage</th><th>Verdict</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} onClick={() => (window.location.hash = `#/record/${r._id}`)}>
                  <td className="mono">{new Date(r.receivedAt).toLocaleString("en-GB", { hour12: false })}</td>
                  <td>{r.from}{r.demo && <span className="tag">demo</span>}</td>
                  <td>{r.subject ?? "—"}</td>
                  <td><Stage stage={r.stage} /></td>
                  <td>{r.verdict ? <Verdict v={r.verdict} /> : <span className="muted">…</span>}{r.reviewer && <span className="tag">reviewed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stage({ stage }: { stage: string }) {
  const steps = ["received", "extracting", "resolving", "decided", "reviewed"];
  const i = steps.indexOf(stage);
  return (
    <span className="stage" title={stage}>
      {steps.map((s, j) => <i key={s} className={j <= i ? "done" : ""} />)}
      <em>{stage}</em>
    </span>
  );
}

function Verdict({ v }: { v: string }) {
  return <span className={`verdict ${v.toLowerCase()}`}>{v.replace("_", " ")}</span>;
}

function Record({ id }: { id: Id<"prospects"> }) {
  const rec = useQuery(api.demo.record, { prospectId: id });
  if (rec === undefined) return <p className="muted">Loading…</p>;
  if (rec === null) return <p className="muted">No such record.</p>;
  const { prospect, parties, verdict, matters } = rec;
  const matterById = new Map(matters.map((m) => [m!._id, m!]));
  return (
    <div className="record">
      <section className="card">
        <div className="row">
          <div>
            <h2>{prospect.subject ?? "(no subject)"}</h2>
            <p className="muted">From <b>{prospect.from}</b> · {new Date(prospect.receivedAt).toLocaleString("en-GB", { hour12: false })} · thread <code>{prospect.threadId}</code></p>
          </div>
          <div className="big">{verdict ? <Verdict v={verdict.verdict} /> : <Stage stage={prospect.stage} />}</div>
        </div>
        <blockquote>{prospect.body}</blockquote>
      </section>

      <section className="card">
        <h3>1. Extract → 2. Expand</h3>
        {parties.length === 0 ? <p className="muted">{prospect.stage === "received" || prospect.stage === "extracting" ? "Extracting parties from the email…" : "No parties recorded."}</p> : parties.map((p) => (
          <div key={p._id} className="party">
            <div className="row">
              <b>{p.rawName}</b>
              <span className={`side ${p.side}`}>{p.side}</span>
              <span className={`res ${p.resolution}`}>{p.resolution}</span>
            </div>
            {p.candidates.length === 0 ? <p className="muted">No registry entity matched this name exactly.</p> : (
              <ul className="cands">
                {p.candidates.map((c) => (
                  <li key={c.companyNumber} className={c.primary ? "primary" : ""}>
                    <code>{c.companyNumber}</code> {c.name} <span className="muted">via {c.source}{c.primary ? " · resolved" : " · alternate"}</span>
                    {c.previousNames.length > 0 && <div className="prev">previously {c.previousNames.join(" · ")}</div>}
                  </li>
                ))}
              </ul>
            )}
            {p.evidence.map((e, i) => (
              <div key={i} className="evidence">
                <span className="tag">{e.kind}</span> <a href={e.url} target="_blank" rel="noreferrer">{e.url}</a> <span className="muted">· {new Date(e.fetchedAt).toLocaleString("en-GB", { hour12: false })}</span>
                <pre>{e.snippet.trim()}</pre>
              </div>
            ))}
          </div>
        ))}
      </section>

      {verdict && (
        <section className="card">
          <h3>3. Compare → 4. {verdict.verdict === "CLEAR" ? "Clear" : "Hold"}</h3>
          <p className="muted">Rule set <code>{verdict.ruleVersion}</code> · decided {new Date(verdict.decidedAt).toLocaleString("en-GB", { hour12: false })} · searched: {verdict.searchedParties.join(", ")}</p>
          <ul className="reasons">{verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {verdict.hits.length > 0 && (
            <table>
              <thead><tr><th>Matched history party</th><th>Role</th><th>Matter</th><th>Via</th></tr></thead>
              <tbody>{verdict.hits.map((h, i) => {
                const m = matterById.get(h.matterId);
                return <tr key={i}><td>{h.matchedName}</td><td><span className={`role ${h.matchedRole}`}>{h.matchedRole.replace("_", " ")}</span></td><td className="mono">{m ? `${m.ref} · ${m.title} · ${m.status}` : h.matterId}</td><td>{h.via}</td></tr>;
              })}</tbody>
            </table>
          )}
          {verdict.reviewer && <p className="reviewed">Reviewed by <b>{verdict.reviewer}</b> · {verdict.reviewerNote}</p>}
          {verdict.letterText && (
            <details open={verdict.verdict === "CLEAR"}>
              <summary>{verdict.verdict === "CLEAR" ? "Engagement draft sent to the prospect" : "Hold notice sent to the prospect"}{verdict.outboundMessageId ? "" : " (demo: recorded, not sent)"}</summary>
              <pre className="letter">{verdict.letterText}</pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function Review() {
  const queue = useQuery(api.board.reviewQueue);
  const review = useMutation(api.board.review);
  const [reviewer, setReviewer] = useState("A. Hollin");
  const [note, setNote] = useState<Record<string, string>>({});
  return (
    <section className="card">
      <h2>Partner review</h2>
      <p className="muted">Everything the engine could not clear on its own. Your decision is recorded beside the verdict, never over it.</p>
      <label>Reviewing as<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} /></label>
      {!queue ? <p className="muted">Loading…</p> : queue.length === 0 ? <p className="muted">Queue is empty.</p> : queue.map((q) => (
        <div key={q.prospectId} className="party">
          <div className="row"><a href={`#/record/${q.prospectId}`}><b>{q.subject ?? "(no subject)"}</b> · {q.from}</a><Verdict v={q.verdict} /></div>
          <ul className="reasons">{q.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <input placeholder="Note for the file" value={note[q.prospectId] ?? ""} onChange={(e) => setNote({ ...note, [q.prospectId]: e.target.value })} />
          <div className="chips">
            <button className="chip" onClick={() => review({ prospectId: q.prospectId, reviewer, decision: "confirm_hold", note: note[q.prospectId] ?? "" })}>Confirm hold</button>
            <button className="chip" onClick={() => review({ prospectId: q.prospectId, reviewer, decision: "decline", note: note[q.prospectId] ?? "" })}>Decline instruction</button>
            <button className="chip" onClick={() => review({ prospectId: q.prospectId, reviewer, decision: "proceed_with_consent", note: note[q.prospectId] ?? "" })}>Proceed with informed consent</button>
          </div>
        </div>
      ))}
    </section>
  );
}

function Matters() {
  const ms = useQuery(api.board.matters);
  return (
    <section className="card">
      <h2>Matter history</h2>
      <p className="muted">Seeded, fictional engagements. Company names and numbers are real Companies House records so registry expansion has real previous names to find.</p>
      {!ms ? <p className="muted">Loading…</p> : (
        <table>
          <thead><tr><th>Ref</th><th>Matter</th><th>Status</th><th>Parties</th></tr></thead>
          <tbody>{ms.sort((a, b) => a.ref.localeCompare(b.ref)).map((m) => (
            <tr key={m._id}><td className="mono">{m.ref}</td><td>{m.title}</td><td>{m.status}</td><td>{m.parties.map((p) => <div key={p._id}><span className={`role ${p.role}`}>{p.role.replace("_", " ")}</span> {p.name} {p.companyNumber && <code>{p.companyNumber}</code>}</div>)}</td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
