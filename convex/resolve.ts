import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";

const firecrawl = new FirecrawlClient(components.firecrawl);

// Registration-number patterns as they appear on UK legal/terms pages.
const COMPANY_NO = /(?:company|registration|registered)\s*(?:number|no\.?|#)?\s*[:\-]?\s*(?:is\s+)?([0-9]{8}|[A-Z]{2}[0-9]{6})\b/gi;
const LEGAL_NAME = /\b([A-Z][A-Za-z&'.\- ]{2,60}?\s(?:Limited|Ltd\.?|PLC|plc|LLP))\b/g;

// Pre-flight step 2: does the sender's own site name a legal entity the registry
// keyword search would miss? Returns every candidate with the snippet it came from.
export const brandToEntity = action({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    const urls = [`https://${domain}/terms`, `https://${domain}/legal`, `https://${domain}/about`, `https://${domain}/`];
    const out: { url: string; companyNumbers: string[]; legalNames: string[]; snippet: string; fetchedAt: number }[] = [];
    for (const url of urls) {
      try {
        const res: any = await firecrawl.scrape(ctx, url, { formats: ["markdown"], onlyMainContent: false, maxAge: 3_600_000 });
        const md: string = res?.markdown ?? res?.data?.markdown ?? "";
        if (!md) continue;
        const numbers = [...md.matchAll(COMPANY_NO)].map((m) => m[1]);
        const names = [...new Set([...md.matchAll(LEGAL_NAME)].map((m) => m[1].trim()))];
        if (numbers.length || names.length) {
          const idx = numbers.length ? md.search(COMPANY_NO) : md.search(LEGAL_NAME);
          out.push({ url, companyNumbers: [...new Set(numbers)], legalNames: names.slice(0, 5), snippet: md.slice(Math.max(0, idx - 160), idx + 200), fetchedAt: Date.now() });
          if (numbers.length) break;
        }
      } catch (e: any) {
        out.push({ url, companyNumbers: [], legalNames: [], snippet: `ERROR ${e?.message ?? e}`, fetchedAt: Date.now() });
      }
    }
    return out;
  },
});
