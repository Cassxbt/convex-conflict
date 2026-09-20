import { readFileSync } from "node:fs";
import { searchCompanies, getCompany } from "../shared/companiesHouse.ts";
const env = Object.fromEntries(readFileSync(`${process.env.HOME}/.allgas/env`, "utf8").split("\n").filter(l => l.includes("=")).map(l => l.split("=", 2) as [string, string]));
const key = env.CH_API_KEY;

// What a registry keyword search returns for the brand the prospect would type
const kw = await searchCompanies(key, "The Whisky Exchange", 5);
console.log("registry keyword search 'The Whisky Exchange':"); console.table(kw);

// What Firecrawl finds on the brand's own pages, via the deployed action (needs `npx convex dev` login)
import { execSync } from "node:child_process";
const found = JSON.parse(execSync(`npx convex run resolve:brandToEntity '{"domain":"thewhiskyexchange.com"}'`, { encoding: "utf8" }));
const number = found.find((e: any) => e.companyNumbers.length)?.companyNumbers[0];
if (!number) throw new Error("Firecrawl did not find a company number on thewhiskyexchange.com");
const fc = await getCompany(key, number);
console.log("Firecrawl-resolved entity:", fc.companyNumber, fc.name, fc.status);

const top = kw[0]?.companyNumber;
console.log(top === number
  ? "FAIL: keyword search already returns the same entity — Firecrawl did not change the result"
  : `PASS: keyword top hit ${top} (${kw[0]?.name}) != Firecrawl-resolved ${number} (${fc.name}) — Firecrawl changed the resolution`);
