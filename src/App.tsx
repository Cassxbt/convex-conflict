import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Toaster } from "sonner";
import { api } from "../convex/_generated/api";
import { Nav } from "./components/Nav";
import { Palette } from "./components/Palette";
import { FIXTURES, go, useRoute } from "./lib/route";
import { Intake } from "./views/Intake";
import { Record } from "./views/Record";
import { Review } from "./views/Review";
import { Matters } from "./views/Matters";
import { Home } from "./views/Home";
import { Proof } from "./views/Proof";

export default function App() {
  const route = useRoute();
  const queue = useQuery(api.board.reviewQueue);
  const rows = useQuery(api.board.listProspects) ?? [];
  const submit = useMutation(api.demo.submit);
  const [palette, setPalette] = useState(false);

  async function runFixture(key: string) {
    const f = FIXTURES.find((x) => x.key === key)!;
    const id = await submit({ from: f.from, subject: f.subject, body: f.body });
    go(`#/record/${id}`);
  }

  // Nav anchors are written #/#section so the hash router keeps the home view; scroll here.
  useEffect(() => {
    const m = window.location.hash.match(/^#\/#([a-z]+)$/);
    if (!m) return;
    const el = document.getElementById(m[1]);
    if (el) scrollToSection(el);
  }, [route]);

  // #/run/<fixture> files the example once, then hands off to the record page.
  const ran = useRef<string | null>(null);
  useEffect(() => {
    if (route.view !== "run" || ran.current === route.key) return;
    ran.current = route.key;
    void runFixture(route.key);
  }, [route]);

  return (
    <div className="shell">
      <Nav route={route} queueCount={queue?.length ?? 0} onPalette={() => setPalette(true)} />
      <main id="main" className={route.view === "home" ? "wide" : ""}>
        {(route.view === "home" || route.view === "run") && <Home onRun={runFixture} />}
        {route.view === "proof" && <Proof />}
        {route.view === "intake" && <Intake />}
        {route.view === "review" && <Review />}
        {route.view === "record" && <Record id={route.id} />}
        {route.view === "matters" && <Matters />}
      </main>
      <footer className="notice">
        <span className="meta">Screening aid</span>
        Conflict Clear searches, expands and records; it does not decide. A supervising solicitor reviews every outcome, and CONFLICT and NEEDS_REVIEW never send an engagement letter.
      </footer>
      <Palette open={palette} setOpen={setPalette} rows={rows} onRunFixture={runFixture} />
      <Toaster position="bottom-right" duration={2000} toastOptions={{ className: "toast" }} />
    </div>
  );
}

// Native smooth scrolling is silently dropped by some browsers, so the eased scroll is our own.
function scrollToSection(el: HTMLElement) {
  el.classList.add("in");
  const target = el.getBoundingClientRect().top + window.scrollY - 84;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, target); return; }
  const start = window.scrollY, delta = target - start, t0 = performance.now(), ms = 520;
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    window.scrollTo(0, start + delta * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
