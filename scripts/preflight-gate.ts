import { readFileSync } from "node:fs";
import { searchCompanies, getCompany } from "../shared/companiesHouse.ts";
const env = Object.fromEntries(readFileSync(`${process.env.HOME}/.allgas/env`, "utf8").split("\n").filter(l => l.includes("=")).map(l => l.split("=", 2) as [string, string]));
const key = env.CH_API_KEY;

// What a registry keyword search returns for the brand the prospect would type
const kw = await searchCompanies(key, "The Whisky Exchange", 5);
console.log("registry keyword search 'The Whisky Exchange':"); console.table(kw);

// What Firecrawl found on the brand's own terms page
const fc = await getCompany(key, "04449145");
console.log("Firecrawl-resolved entity:", fc.companyNumber, fc.name, fc.status);

const top = kw[0]?.companyNumber;
console.log(top === "04449145"
  ? "FAIL: keyword search already returns the same entity — Firecrawl did not change the result"
  : `PASS: keyword top hit ${top} (${kw[0]?.name}) != Firecrawl-resolved 04449145 (${fc.name}) — Firecrawl changed the resolution`);
