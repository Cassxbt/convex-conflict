import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Ban, Check, PauseCircle, ShieldCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Empty, Verdict } from "../components/ui";

export function Review() {
  const queue = useQuery(api.board.reviewQueue);
  const review = useMutation(api.board.review);
  const [reviewer, setReviewer] = useState("");
  const [staffKey, setStaffKey] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(prospectId: Id<"prospects">, decision: "confirm_hold" | "decline" | "proceed_with_consent") {
    setBusy(prospectId);
    try {
      await review({ prospectId, reviewer, decision, note: note[prospectId] ?? "", staffKey: staffKey || undefined });
      toast("Review recorded");
    } catch (e: any) {
      toast(String(e?.data ?? e?.message ?? "Could not record the review").replace(/^.*Uncaught Error: /, ""));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="review">
      <header className="panel-head">
        <h1><ShieldCheck size={18} strokeWidth={1.75} aria-hidden />Partner review</h1>
        <p className="lede">Everything the engine could not clear on its own. Your decision is recorded beside the verdict, never over it.</p>
      </header>
      <div className="row">
        <label className="field inline"><span className="meta">Reviewing as</span><input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" /></label>
        <label className="field inline"><span className="meta">Staff passphrase</span><input type="password" value={staffKey} onChange={(e) => setStaffKey(e.target.value)} placeholder="only for email records" autoComplete="off" /></label>
      </div>

      {!queue ? <Empty>Loading…</Empty> : queue.length === 0 ? (
        <section className="band"><p className="band-empty">The queue is empty. Nothing is waiting on a solicitor.</p></section>
      ) : queue.map((q) => (
        <section key={q.prospectId} className="band case appear" aria-labelledby={`case-${q.prospectId}`}>
          <div className="band-head">
            <h2 id={`case-${q.prospectId}`}><a href={`#/record/${q.prospectId}`}>{q.subject ?? "(no subject)"}</a><span className="meta">{q.from}{q.email ? " · email · passphrase needed" : " · console"}</span></h2>
            <Verdict v={q.verdict} />
          </div>
          <ol className="reasons">{q.reasons.map((r, i) => <li key={i}>{r}</li>)}</ol>
          <label className="field dark"><span className="meta">Note for the file</span><input value={note[q.prospectId] ?? ""} onChange={(e) => setNote({ ...note, [q.prospectId]: e.target.value })} placeholder="What you checked, and why" /></label>
          <div className="actions">
            <button type="button" className="btn ghost" disabled={busy === q.prospectId || !reviewer.trim()} onClick={() => decide(q.prospectId, "confirm_hold")}><PauseCircle size={15} strokeWidth={1.75} aria-hidden />Confirm hold</button>
            <button type="button" className="btn ghost" disabled={busy === q.prospectId || !reviewer.trim()} onClick={() => decide(q.prospectId, "decline")}><Ban size={15} strokeWidth={1.75} aria-hidden />Decline instruction</button>
            <button type="button" className="btn ghost" disabled={busy === q.prospectId || !reviewer.trim()} onClick={() => decide(q.prospectId, "proceed_with_consent")}><Check size={15} strokeWidth={1.75} aria-hidden />Proceed with informed consent</button>
          </div>
        </section>
      ))}
    </div>
  );
}
