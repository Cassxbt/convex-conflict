import { internalAction } from "./_generated/server";
import { components } from "./_generated/api";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";

const firecrawl = new FirecrawlClient(components.firecrawl);

// Registration-number patterns as they appear on UK legal/terms pages.
const COMPANY_NO = /(?:company|registration|registered|reg\.?)\s*(?:in\s+england(?:\s+(?:and|&)\s+wales)?)?\s*(?:number|no\.?|#)?\s*[:\-]?\s*(?:is\s+)?([0-9]{8}|[A-Z]{2}[0-9]{6})\b/gi;
const LEGAL_NAME = /\b([A-Z][A-Za-z&'.\- ]{2,60}?\s(?:Limited|Ltd\.?|PLC|plc|LLP))\b/g;

// Pre-flight step 2: does the sender's own site name a legal entity the registry
// keyword search would miss? Returns every candidate with the snippet it came from.
export const brandToEntity = internalAction({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    // Two pages in parallel (Firecrawl free tier allows 2 concurrent jobs), each bounded so a
    // slow retail site cannot stall intake. The homepage footer usually carries the number.
    const urls = [`https://${domain}/`, `https://${domain}/terms`];
    const out: { url: string; companyNumbers: string[]; legalNames: string[]; snippet: string; fetchedAt: number }[] = [];
    const results = await Promise.all(urls.map(async (url) => {
      try {
        const res: any = await firecrawl.scrape(ctx, url, { formats: ["markdown"], onlyMainContent: false, maxAge: 86_400_000, timeout: 25_000 });
        return { url, md: (res?.markdown ?? res?.data?.markdown ?? "") as string, error: null as string | null };
      } catch (e: any) {
        return { url, md: "", error: String(e?.message ?? e) };
      }
    }));
    for (const { url, md, error } of results) {
      if (error) { out.push({ url, companyNumbers: [], legalNames: [], snippet: `ERROR ${error}`, fetchedAt: Date.now() }); continue; }
      if (!md) continue;
      const numbers = [...new Set([...md.matchAll(COMPANY_NO)].map((m) => m[1]))];
      const names = [...new Set([...md.matchAll(LEGAL_NAME)].map((m) => m[1].trim()))];
      if (numbers.length || names.length) {
        const idx = numbers.length ? md.search(COMPANY_NO) : md.search(LEGAL_NAME);
        out.push({ url, companyNumbers: numbers, legalNames: names.slice(0, 5), snippet: md.slice(Math.max(0, idx - 160), idx + 200), fetchedAt: Date.now() });
      }
    }
    // Prefer a page that yielded a number.
    return out.sort((a, b) => b.companyNumbers.length - a.companyNumbers.length);
  },
});
