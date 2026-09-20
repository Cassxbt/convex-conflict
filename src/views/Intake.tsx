import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Mail, Radio } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { FIXTURES, fmtTime, go } from "../lib/route";
import { Empty, Stage, Verdict } from "../components/ui";

export function Intake({ initial }: { initial?: string }) {
  const rows = useQuery(api.board.listProspects);
  const submit = useMutation(api.demo.submit);
  const seed = FIXTURES.find((f) => f.key === initial) ?? FIXTURES[1];
  const [from, setFrom] = useState<string>(seed.from);
  const [subject, setSubject] = useState<string>(seed.subject);
  const [body, setBody] = useState<string>(seed.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true); setError(null);
    try {
      const id = await submit({ from, subject, body });
      go(`#/record/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Could not start the screen.");
    } finally {
      setBusy(false);
    }
  }

  const live = rows?.filter((r) => r.stage !== "decided" && r.stage !== "reviewed") ?? [];

  return (
    <div className="intake">
      <section className="panel compose" aria-labelledby="compose-h">
        <div className="panel-head">
          <h1 id="compose-h">Screen an instruction</h1>
          <p className="lede">Prospects write to the case inbox. Paste an instruction here to run the identical screen without sending anything.</p>
        </div>
        <div className="chips" role="group" aria-label="Examples">
          {FIXTURES.map((f) => (
            <button key={f.key} type="button" className={`chip ${f.key}`} onClick={() => { setFrom(f.from); setSubject(f.subject); setBody(f.body); }}>{f.label}</button>
          ))}
        </div>
        <label className="field"><span className="meta">From</span><input value={from} onChange={(e) => setFrom(e.target.value)} spellCheck={false} /></label>
        <label className="field"><span className="meta">Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label className="field"><span className="meta">Email</span><textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="button" className="btn primary" disabled={busy || !body.trim()} data-state={busy ? "loading" : undefined} onClick={send}>
          {busy ? "Starting…" : "Run conflict screen"}{!busy && <ArrowRight size={16} strokeWidth={2} aria-hidden />}
        </button>
        <p className="fine">Two bounded model calls: party extraction and letter fill. The verdict is deterministic code over the registry and the firm's history.</p>
      </section>

      <div className="board">
        <section className="band" aria-labelledby="live-h">
          <div className="band-head">
            <h2 id="live-h"><Radio size={14} strokeWidth={2} aria-hidden />Live</h2>
            <span className="meta">{live.length === 0 ? "nothing in flight" : `${live.length} in flight`}</span>
          </div>
          {live.length === 0 ? (
            <p className="band-empty">The inbox is quiet. New instructions appear here the moment the webhook lands.</p>
          ) : (
            <ul className="live-list">
              {live.map((r) => (
                <li key={r._id} className="live-row appear">
                  <button type="button" onClick={() => go(`#/record/${r._id}`)}>
                    <span className="live-from">{r.from}</span>
                    <span className="live-subject">{r.subject ?? "(no subject)"}</span>
                    <Stage stage={r.stage} compact />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="board-h">
          <div className="panel-head row">
            <h2 id="board-h"><Mail size={16} strokeWidth={1.75} aria-hidden />Intake board</h2>
            <span className="meta">{rows ? `${rows.length} instructions` : ""}</span>
          </div>
          {!rows ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>Nothing received yet.</Empty> : (
            <table className="grid">
              <thead><tr><th>Received</th><th>From</th><th>Subject</th><th>Stage</th><th>Verdict</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="appear" tabIndex={0} onClick={() => go(`#/record/${r._id}`)} onKeyDown={(e) => { if (e.key === "Enter") go(`#/record/${r._id}`); }}>
                    <td className="mono">{fmtTime(r.receivedAt)}</td>
                    <td className="from">{r.from}{r.demo && <span className="tag">demo</span>}</td>
                    <td>{r.subject ?? "—"}</td>
                    <td><Stage stage={r.stage} /></td>
                    <td>{r.verdict ? <Verdict v={r.verdict} /> : <span className="meta">pending</span>}{r.reviewer && <span className="tag">reviewed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
