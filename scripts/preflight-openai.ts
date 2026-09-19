import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(`${process.env.HOME}/.allgas/env`, "utf8").split("\n").filter(l => l.includes("=")).map(l => l.split("=", 2) as [string, string]));
const res = await fetch("https://api.openai.com/v1/models?limit=3", { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` } });
console.log("status", res.status, res.ok ? "PASS: key valid" : "FAIL: " + (await res.text()).slice(0, 200));
