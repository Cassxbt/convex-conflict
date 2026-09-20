import { CircleCheck, CircleAlert, CircleDashed } from "lucide-react";

export function Verdict({ v, size = "sm" }: { v: string; size?: "sm" | "lg" }) {
  const k = v.toLowerCase();
  const Icon = k === "clear" ? CircleCheck : k === "conflict" ? CircleAlert : CircleDashed;
  return (
    <span className={`verdict ${k} ${size}`}>
      <Icon size={size === "lg" ? 18 : 14} strokeWidth={2} aria-hidden />
      {v.replace("_", " ")}
    </span>
  );
}

const STEPS = ["received", "extracting", "resolving", "decided", "reviewed"] as const;

export function Stage({ stage, compact }: { stage: string; compact?: boolean }) {
  const i = STEPS.indexOf(stage as (typeof STEPS)[number]);
  const pct = Math.max(0, i) / (STEPS.length - 1);
  return (
    <span className={`stage ${compact ? "compact" : ""}`} title={stage} aria-label={`stage ${stage}`}>
      <span className="stage-track"><span className="stage-fill" style={{ transform: `scaleX(${pct})` }} /></span>
      <span className="stage-label">{stage}</span>
    </span>
  );
}

export function Role({ r }: { r: string }) {
  return <span className={`role ${r}`}>{r.replace("_", " ")}</span>;
}

export function Meta({ children }: { children: React.ReactNode }) {
  return <span className="meta">{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
