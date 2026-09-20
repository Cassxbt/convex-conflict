import { useQuery } from "convex/react";
import { ArrowRight, Globe, Hash, Landmark, Mail, ShieldCheck, Sparkles, Database, Scale, UserRound, Inbox } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { fmtTime } from "../lib/route";
import { Role, Verdict } from "../components/ui";

const REPO = import.meta.env.VITE_REPO_URL as string | undefined;

export function Home() {
  const stats = useQuery(api.board.stats);
  const latest = useQuery(api.demo.record, stats?.latestConflictId ? { prospectId: stats.latestConflictId } : "skip");

  return (
    <div className="front">
      <section className="hero">
        <div className="hero-copy">
          <div className="badges">
            <span className="badge"><Landmark size={12} strokeWidth={2} aria-hidden />Companies House · live register</span>
            <span className="badge"><span className="dot live" aria-hidden />convex.site · production</span>
          </div>
          <h1>Keyword search says clear.<br />The register says former client.</h1>
          <p className="lede-lg">
            A prospect emails the firm. Conflict Clear resolves every party to a registered entity, using the sender's own website for the names the register cannot see, searches the matter history including previous names, and returns CLEAR, CONFLICT or NEEDS_REVIEW with a written record. Only CLEAR can draft an engagement letter. A solicitor signs off every state.
          </p>
          <div className="cta-row">
            <a className="btn primary inline" href="#/app">Open the console<ArrowRight size={16} strokeWidth={2} aria-hidden /></a>
            <a className="btn outline" href="#/proof">Read the proof</a>
          </div>
          <p className="status-line mono">
            {stats ? <>
              live · {stats.screened} instruction{stats.screened === 1 ? "" : "s"} screened · {stats.byVerdict.CONFLICT} held as conflict · {stats.byVerdict.NEEDS_REVIEW} for review · {stats.previousNames} previous names expanded · engine {stats.ruleVersion} · 8 tests
            </> : "connecting…"}
          </p>
        </div>

        <aside className="hero-artifact band" aria-label="Latest conflict record">
          <div className="band-head">
            <h2><ShieldCheck size={14} strokeWidth={2} aria-hidden />Latest held record</h2>
            {latest?.verdict && <Verdict v={latest.verdict.verdict} />}
          </div>
          {!latest?.verdict ? (
            <p className="band-empty">No conflict on record yet. Run the Conflict example in the console and this card fills in.</p>
          ) : (
            <>
              <dl className="readout-meta">
                <div><dt>instruction</dt><dd>{latest.prospect.subject}</dd></div>
                <div><dt>searched</dt><dd>{latest.verdict.searchedParties.join(" · ")}</dd></div>
                <div><dt>decided</dt><dd className="mono">{fmtTime(latest.verdict.decidedAt)}</dd></div>
              </dl>
              <table className="grid dark compact">
                <thead><tr><th>History party</th><th>Role</th><th>Via</th></tr></thead>
                <tbody>{latest.verdict.hits.slice(0, 3).map((h, i) => (
                  <tr key={i}><td>{h.matchedName}</td><td><Role r={h.matchedRole} /></td><td>{h.via}</td></tr>
                ))}</tbody>
              </table>
              <a className="artifact-link" href={`#/record/${latest.prospect._id}`}>Open the full record<ArrowRight size={14} strokeWidth={2} aria-hidden /></a>
            </>
          )}
        </aside>
      </section>

      <section className="section" id="failure">
        <span className="meta">The failure</span>
        <h2 className="statement">"International Distribution Services Limited" is in no law firm's history. Royal Mail plc is. They are the same company.</h2>
        <div className="split">
          <div>
            <p>Company 08680755 was <b>Royal Mail plc</b> from 19 September 2013 to 3 October 2022. A keyword conflict search for the name on the prospect's email returns nothing. The firm acted for Royal Mail on a supply-contract dispute in 2019 and still holds its confidential information. SRA Code 6.5 says that means the firm cannot act against it.</p>
            <p>Conflict checking is required on every instruction, and the SRA's own guidance says it normally runs on a database that identifies "previous or current clients and related names and businesses". Most small firms search a name, not a company number.</p>
          </div>
          <figure className="registry-card">
            <figcaption className="meta"><Hash size={12} strokeWidth={2} aria-hidden />Companies House · 08680755</figcaption>
            <ol className="names">
              <li><span>INTERNATIONAL DISTRIBUTION SERVICES LIMITED</span><span className="mono">2025 – now</span></li>
              <li><span>INTERNATIONAL DISTRIBUTION SERVICES PLC</span><span className="mono">2024 – 2025</span></li>
              <li><span>INTERNATIONAL DISTRIBUTIONS SERVICES PLC</span><span className="mono">2022 – 2024</span></li>
              <li className="hit"><span>ROYAL MAIL PLC</span><span className="mono">2013 – 2022</span></li>
              <li><span>ROYAL MAIL LIMITED</span><span className="mono">2013</span></li>
            </ol>
            <p className="fine">Previous names as returned by the Companies House API on the day of the screen.</p>
          </figure>
        </div>
      </section>

      <section className="section" id="mechanism">
        <span className="meta">How it works</span>
        <h2 className="statement">Extract. Expand. Compare. Hold or clear.</h2>
        <ol className="steps">
          <li><span className="mono">01</span><h3>Extract</h3><p>The email arrives in the case inbox through a signed webhook. One structured-output call lists the parties and which side they are on. It does not infer entities and it does not see the matter history.</p></li>
          <li><span className="mono">02</span><h3>Expand</h3><p>Each name is searched on the register; every candidate's current and previous names are fetched. The sender's own legal page is read to pin the brand to the registered entity the register would not have chosen.</p></li>
          <li><span className="mono">03</span><h3>Compare</h3><p>Deterministic code matches every alias against the firm's matter parties by company number and normalised name. A prospect who was once adverse, or an opponent who was once a client, is a conflict. Ambiguity is never resolved by guessing.</p></li>
          <li><span className="mono">04</span><h3>Hold or clear</h3><p>CLEAR drafts an engagement letter into the thread. CONFLICT and NEEDS_REVIEW send a hold notice that gives no reason, and the case lands on the partner's queue with the hop that caused it.</p></li>
        </ol>
      </section>

      <section className="section" id="sponsors">
        <span className="meta">Five systems, one verdict</span>
        <h2 className="statement">Each one does work the others cannot. Remove any of them and the screen breaks in a specific way.</h2>
        <ul className="systems">
          <li>
            <h3><Mail size={16} strokeWidth={1.75} aria-hidden />AgentMail</h3>
            <p><b>Does:</b> the prospect's email is the trigger. The signed webhook creates the case; the sender domain seeds entity resolution; the hold notice or engagement draft goes back on the same thread.</p>
            <p className="counter"><b>Remove it:</b> there is no intake event, no sender domain to resolve, and no channel for the letter. The product has no front door.</p>
          </li>
          <li>
            <h3><Globe size={16} strokeWidth={1.75} aria-hidden />Firecrawl</h3>
            <p><b>Does:</b> reads the sender's legal or terms page and lifts the registered company number and legal name a brand actually trades under.</p>
            <p className="counter"><b>Remove it:</b> a register search for "The Whisky Exchange" resolves to The Whisky Exchange Limited (14220596). The trading page says Speciality Drinks Limited (04449145). Wrong entity, wrong history, false CLEAR.</p>
          </li>
          <li>
            <h3><Landmark size={16} strokeWidth={1.75} aria-hidden />Companies House API</h3>
            <p><b>Does:</b> search, profiles, previous names, status. Not a sponsor, and named honestly: the register has an API, so nothing is scraped from it.</p>
            <p className="counter"><b>Remove it:</b> the Royal Mail hop above is never made.</p>
          </li>
          <li>
            <h3><Sparkles size={16} strokeWidth={1.75} aria-hidden />OpenAI</h3>
            <p><b>Does:</b> exactly two bounded structured-output calls: extract the parties from the email; fill the letter from the verdict object.</p>
            <p className="counter"><b>Remove it:</b> parties are typed by hand and the letter is a template with blanks. The verdict is unaffected, by design.</p>
          </li>
          <li>
            <h3><Database size={16} strokeWidth={1.75} aria-hidden />Convex</h3>
            <p><b>Does:</b> durable intake workflow, the matter history, the verdict record with rule version and timestamp, the partner queue, and the live two-role board. Frontend and webhooks on one deployment.</p>
            <p className="counter"><b>Remove it:</b> there is no record of who was searched, what was found, and who decided. SRA Code for Firms 2.2 requires exactly that record.</p>
          </li>
        </ul>
      </section>

      <section className="section" id="line">
        <span className="meta">One side of the line</span>
        <h2 className="statement">The model never sees the matter history.</h2>
        <div className="line-grid">
          <div className="line-col">
            <h3><Sparkles size={15} strokeWidth={1.75} aria-hidden />The model does</h3>
            <ul><li>Read the email and list the parties</li><li>Say which side each party is on</li><li>Fill the letter template from a verdict object</li></ul>
          </div>
          <div className="line-col">
            <h3><Scale size={15} strokeWidth={1.75} aria-hidden />Code does</h3>
            <ul><li>Resolve names against the register</li><li>Match aliases to the firm's history</li><li>Decide CLEAR, CONFLICT or NEEDS_REVIEW</li><li>Refuse to clear anything it could not resolve</li></ul>
          </div>
        </div>
      </section>

      <section className="section" id="doors">
        <span className="meta">Three doors</span>
        <div className="doors">
          <a href="#/app" className="door"><span className="meta"><UserRound size={12} strokeWidth={2} aria-hidden />Prospect</span><h3>Email the firm and get a reply that says exactly one of two things.</h3><span className="door-cta">See what they receive<ArrowRight size={14} strokeWidth={2} aria-hidden /></span></a>
            <a href="#/app" className="door"><span className="meta"><Inbox size={12} strokeWidth={2} aria-hidden />Intake</span><h3>Watch every instruction resolve on a live board, and read the record.</h3><span className="door-cta">Open the console<ArrowRight size={14} strokeWidth={2} aria-hidden /></span></a>
          <a href="#/review" className="door"><span className="meta"><ShieldCheck size={12} strokeWidth={2} aria-hidden />Partner</span><h3>Review only what the engine refused to clear, with the hop that stopped it.</h3><span className="door-cta">Open the queue<ArrowRight size={14} strokeWidth={2} aria-hidden /></span></a>
        </div>
      </section>

      <section className="section" id="real">
        <span className="meta">What is real, and what is not</span>
        <table className="grid honesty">
          <tbody>
            <tr><td>Companies House data</td><td><span className="ok">Real.</span> Live API calls; previous names, status and numbers are the register's.</td></tr>
            <tr><td>Website evidence</td><td><span className="ok">Real.</span> Firecrawl reads the sender domain's pages on each screen; URL, snippet and time are stored on the record.</td></tr>
            <tr><td>Email round trip</td><td><span className="ok">Real.</span> The case inbox receives through a signed AgentMail webhook and replies on the original thread. Records opened from the console are marked <span className="mono">demo</span>: the letter is recorded, not sent.</td></tr>
            <tr><td>The firm and its matters</td><td><span className="warn">Fictional.</span> Hollin &amp; Vance LLP does not exist. Twelve matters were seeded so the register has something real to hit; the company names and numbers in them are real.</td></tr>
            <tr><td>The verdict</td><td><span className="ok">Deterministic.</span> Rule set <span className="mono">cc-rules-v1</span>, eight tests, no model in the loop.</td></tr>
            <tr><td>Legal status</td><td><span className="warn">A screening aid.</span> CLEAR is a recommendation to the supervising solicitor, who remains responsible under SRA Code paragraph 6.</td></tr>
            <tr><td>Auth</td><td><span className="warn">None.</span> The console is open so a judge can use it. A firm would put it behind its identity provider.</td></tr>
          </tbody>
        </table>
      </section>

      <section className="closing band">
        <h2 className="statement light">Extract. Expand. Compare. Hold or clear.</h2>
        <div className="cta-row">
          <a className="btn primary inline" href="#/app">Open the console<ArrowRight size={16} strokeWidth={2} aria-hidden /></a>
          <a className="btn ghost" href="#/proof">Read the proof</a>
          {REPO && <a className="btn ghost" href={REPO} target="_blank" rel="noreferrer">Source</a>}
        </div>
      </section>
    </div>
  );
}


