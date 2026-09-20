import { Inbox, ShieldCheck, Library, Command, Search } from "lucide-react";
import type { Route } from "../lib/route";

export function Nav({ route, queueCount, onPalette }: { route: Route; queueCount: number; onPalette: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="nav">
      <a href="#/" className="wordmark">
        <span className="wordmark-name">Conflict Clear</span>
        <span className="meta">Hollin &amp; Vance LLP · Intake</span>
      </a>
      <nav className="nav-links" aria-label="Primary">
        <a href="#/" aria-current={route.view === "intake" ? "page" : undefined}><Inbox size={16} strokeWidth={1.75} aria-hidden /><span className="label">Intake</span></a>
        <a href="#/review" aria-current={route.view === "review" ? "page" : undefined}>
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden /><span className="label">Partner review</span>
          {queueCount > 0 && <span className="count" aria-label={`${queueCount} awaiting review`}>{queueCount}</span>}
        </a>
        <a href="#/matters" aria-current={route.view === "matters" ? "page" : undefined}><Library size={16} strokeWidth={1.75} aria-hidden /><span className="label">Matter history</span></a>
      </nav>
      <button className="kbd-trigger" onClick={onPalette} aria-label="Open command palette">
        <Search size={14} strokeWidth={2} aria-hidden />
        <span className="kbd-hint"><Command size={11} strokeWidth={2.25} aria-hidden />{isMac ? "K" : "Ctrl K"}</span>
      </button>
    </header>
  );
}
