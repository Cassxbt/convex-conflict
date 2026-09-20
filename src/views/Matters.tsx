import { useQuery } from "convex/react";
import { Library } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Empty, Role } from "../components/ui";

export function Matters() {
  const ms = useQuery(api.board.matters);
  return (
    <div className="matters">
      <header className="panel-head">
        <h1><Library size={18} strokeWidth={1.75} aria-hidden />Matter history</h1>
        <p className="lede">Fictional engagements for a fictional firm. Company names and numbers are real Companies House records, so registry expansion has real previous names to find.</p>
      </header>
      <section className="panel">
        {!ms ? <Empty>Loading…</Empty> : (
          <table className="grid">
            <thead><tr><th>Ref</th><th>Matter</th><th>Status</th><th>Parties</th></tr></thead>
            <tbody>{[...ms].sort((a, b) => a.ref.localeCompare(b.ref)).map((m) => (
              <tr key={m._id}>
                <td className="mono">{m.ref}</td>
                <td>{m.title}</td>
                <td><span className={`status ${m.status}`}>{m.status}</span></td>
                <td className="parties-cell">{m.parties.map((p) => <span key={p._id} className="party-inline"><Role r={p.role} /> {p.name}{p.companyNumber && <span className="mono muted"> {p.companyNumber}</span>}</span>)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
