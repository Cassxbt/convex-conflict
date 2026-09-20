import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export type Route =
  | { view: "home" }
  | { view: "proof" }
  | { view: "intake" }
  | { view: "review" }
  | { view: "matters" }
  | { view: "record"; id: Id<"prospects"> };

export function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("record/")) return { view: "record", id: h.slice(7) as Id<"prospects"> };
  if (h === "review") return { view: "review" };
  if (h === "matters") return { view: "matters" };
  if (h === "proof") return { view: "proof" };
  if (h === "app" || h === "intake") return { view: "intake" };
  return { view: "home" };
}

export function go(path: string) {
  window.location.hash = path;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parseRoute);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const FIXTURES = [
  { key: "clear", label: "Clear", from: "legal@ocado.com", subject: "Chilled logistics contract", body: "Ocado Retail wants to instruct you against our supplier Reed Boardall Cold Storage Limited over a chilled-logistics contract.\n\nLegal team, Ocado Retail Limited" },
  { key: "conflict", label: "Conflict", from: "legal@universalppe.co.uk", subject: "Cancelled supply contract", body: "We want to instruct you to sue International Distribution Services Limited over a cancelled supply contract.\n\nRegards, Universal PPE Ltd" },
  { key: "review", label: "Needs review", from: "dan.okafor@gmail.com", subject: "Franchise claim", body: "I am a franchisee and want to bring a claim against Timpson for breach of the franchise agreement.\n\nDan Okafor" },
] as const;

export function fmtTime(ms: number) {
  return new Date(ms).toLocaleString("en-GB", { hour12: false, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
