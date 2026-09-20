import { useEffect } from "react";
import { Command } from "cmdk";
import { Inbox, ShieldCheck, Library, Play, FileText, CircleCheck, CircleAlert, CircleDashed, Home, FileSearch } from "lucide-react";
import { FIXTURES, go } from "../lib/route";

type Row = { _id: string; from: string; subject?: string | null; verdict: string | null };

// Opens on click and ⌘K / Ctrl+K. No open/close animation: it is a keyboard action
// used many times a day, and Emil's rule is that those never animate.
export function Palette({ open, setOpen, rows, onRunFixture }: { open: boolean; setOpen: (v: boolean) => void; rows: Row[]; onRunFixture: (key: string) => void }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!open); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const run = (fn: () => void) => { setOpen(false); fn(); };
  const icon = (v: string | null) => v === "CLEAR" ? CircleCheck : v === "CONFLICT" ? CircleAlert : v === "NEEDS_REVIEW" ? CircleDashed : FileText;

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette" className="palette" overlayClassName="palette-overlay" contentClassName="palette-dialog">
      <Command.Input placeholder="Jump to a view, a record, or run a screen…" autoFocus />
      <Command.List>
        <Command.Empty>Nothing matches.</Command.Empty>
        <Command.Group heading="Go to">
          <Command.Item onSelect={() => run(() => go("#/"))}><Home size={15} strokeWidth={1.75} />Front page</Command.Item>
          <Command.Item onSelect={() => run(() => go("#/app"))}><Inbox size={15} strokeWidth={1.75} />Intake</Command.Item>
          <Command.Item onSelect={() => run(() => go("#/proof"))}><FileSearch size={15} strokeWidth={1.75} />Proof</Command.Item>
          <Command.Item onSelect={() => run(() => go("#/review"))}><ShieldCheck size={15} strokeWidth={1.75} />Partner review</Command.Item>
          <Command.Item onSelect={() => run(() => go("#/matters"))}><Library size={15} strokeWidth={1.75} />Matter history</Command.Item>
        </Command.Group>
        <Command.Group heading="Run a screen">
          {FIXTURES.map((f) => (
            <Command.Item key={f.key} value={`run ${f.label} ${f.subject}`} onSelect={() => run(() => onRunFixture(f.key))}>
              <Play size={15} strokeWidth={1.75} />{f.label} example <span className="meta">{f.subject}</span>
            </Command.Item>
          ))}
        </Command.Group>
        {rows.length > 0 && (
          <Command.Group heading="Records">
            {rows.slice(0, 12).map((r) => {
              const I = icon(r.verdict);
              return (
                <Command.Item key={r._id} value={`${r.subject ?? ""} ${r.from} ${r.verdict ?? ""}`} onSelect={() => run(() => go(`#/record/${r._id}`))}>
                  <I size={15} strokeWidth={1.75} className={r.verdict ? `ic-${r.verdict.toLowerCase()}` : ""} />
                  {r.subject ?? "(no subject)"} <span className="meta">{r.from}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
