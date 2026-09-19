import { readFileSync } from "node:fs";
import { searchCompanies, getCompany } from "../shared/companiesHouse.ts";

const env = Object.fromEntries(
  readFileSync(`${process.env.HOME}/.allgas/env`, "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => l.split("=", 2) as [string, string]),
);
const key = env.CH_API_KEY;
if (!key) throw new Error("CH_API_KEY missing in ~/.allgas/env");

const search = await searchCompanies(key, "International Distribution Services", 5);
console.log("search:", search);

const ids = await getCompany(key, "08680755");
console.log("profile:", ids.name, ids.status);
console.table(ids.previousNames);

const royalMailHit = ids.previousNames.find((p) => /ROYAL MAIL PLC/i.test(p.name));
console.log(royalMailHit ? "PASS: previous name ROYAL MAIL PLC found via API" : "FAIL: expected ROYAL MAIL PLC in previous names");
