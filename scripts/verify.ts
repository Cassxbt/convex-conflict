// `npm run verify`: what a judge can run with no keys. Runs the engine suite, then reads the
// live deployment's proof endpoint and fails if the README's claims are not what is live.
import { spawnSync } from "node:child_process";

const LIVE = "https://descriptive-goldfish-956.convex.site";

const tests = spawnSync("node", ["--experimental-strip-types", "--test", "test/engine.test.ts"], { encoding: "utf8" });
const pass = Number(/# pass (\d+)/.exec(tests.stdout)?.[1] ?? 0);
const fail = Number(/# fail (\d+)/.exec(tests.stdout)?.[1] ?? 1);
console.log(`engine tests: ${pass} passed, ${fail} failed`);
if (fail !== 0 || pass < 16) { console.error("FAIL: engine suite"); process.exit(1); }

const res = await fetch(`${LIVE}/api/proof`);
if (!res.ok) { console.error(`FAIL: ${LIVE}/api/proof returned ${res.status}`); process.exit(1); }
const p = await res.json();
const v2 = p.records.filter((r: any) => r.ruleVersion === "cc-rules-v2");
const byV = p.byVerdict;
console.log(`live: ${p.live} · screened ${p.screened} · by email ${p.realInbound} · CLEAR ${byV.CLEAR} · CONFLICT ${byV.CONFLICT} · NEEDS_REVIEW ${byV.NEEDS_REVIEW} · rule ${p.ruleVersion} · previous names ${p.previousNames}`);

const checks: [string, boolean][] = [
  ["deployment answers", p.live === true],
  ["current rule set is cc-rules-v2", p.ruleVersion === "cc-rules-v2"],
  ["at least one CLEAR and one CONFLICT and one NEEDS_REVIEW on file", byV.CLEAR > 0 && byV.CONFLICT > 0 && byV.NEEDS_REVIEW > 0],
  ["a record decided under cc-rules-v2 exists", v2.length > 0],
  ["a CONFLICT reached via a previous-name hop exists", p.records.some((r: any) => r.verdict === "CONFLICT" && r.previousNameHop)],
  ["a CLEAR with website evidence exists", p.records.some((r: any) => r.verdict === "CLEAR" && r.websiteEvidence)],
  ["an instruction arrived by email and was answered", p.records.some((r: any) => r.channel === "email" && r.sent)],
];
let bad = 0;
for (const [label, ok] of checks) { console.log(`${ok ? "ok  " : "FAIL"} ${label}`); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
