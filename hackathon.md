# Hackathon log

- **Project:** Conflict Clear
- **Event:** Convex All Gas Hackathon
- **What it does:** A prospect emails a law firm; every party named is resolved to a Companies House entity (using the sender's own website for the aliases the registry cannot see), the firm's matter history is searched including previous names, and the result is CLEAR, CONFLICT or NEEDS_REVIEW with a written search record. Only CLEAR produces an engagement draft, and a solicitor reviews every outcome.
- **Live app:** https://descriptive-goldfish-956.convex.site
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** https://descriptive-goldfish-956.convex.cloud
- **Components:** @convex-dev/static-hosting, @convex-dev/workflow, @convex-dev/workpool
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, actions, HTTP actions, scheduled functions, realtime queries
- **Auth:** none
- **AI models:** gpt-5-mini
- **Started:** 2026-09-19T17:57:41Z
- **Last updated:** 2026-09-19T20:48:50Z

## Log

### 2026-09-19 - c30e902
Backend scaffold for a law-firm conflict screen. Tables for matters, matter parties (with a full-text index on party name), cached registry entities, prospects, prospect parties and verdicts. Registered the static hosting, Firecrawl (`@firecrawl/firecrawl-convex`, mounted at `/firecrawl/`), AgentMail, workflow and workpool components. The AgentMail webhook is mounted at `/agentmail/webhook` and every inbound message becomes a prospect row. A Companies House client and a Firecrawl action that reads a sender domain's legal page for a registered company number were proven against real data: the registry returns `ROYAL MAIL PLC 2013–2022` as a previous name of company 08680755, and a retailer's terms page names a different legal entity from the one a registry keyword search returns. Convex features: schema, tables, indexes, full-text search, mutations, actions, HTTP actions (`convex/schema.ts`, `convex/convex.config.ts`, `convex/http.ts`, `convex/email.ts`, `convex/resolve.ts`, `shared/companiesHouse.ts`).

### 2026-09-19 - e2de14e
Email round trip proven on the dev deployment. A message from an external mailbox arrived through the signed AgentMail webhook, was deduplicated by event id and written as a prospect with its sender domain; a reply sent with `replyToMessage` reached `sent` in the original thread. The published `@agentmail/convex` component declares no environment variables and could not read its API key once the app passed typed env to the Firecrawl component, so the Apache-2.0 component source was vendored into `components/agentmail` with an env declaration; the two failed send attempts before that fix are kept in the component's outbound table (`components/agentmail/convex.config.ts`, `convex/convex.config.ts`, `convex/email.ts`).

### 2026-09-19 - 99aa1b5
The intake workflow: extract, expand, compare, hold or clear. A durable workflow runs one bounded OpenAI structured-output call to list the parties in the email, resolves each name through Companies House search and company profiles with previous names, pins the prospect's own entity from a Firecrawl read of the sender domain, then computes the verdict in a single mutation over the firm's matter history with a deterministic engine that has no model in it (`shared/engine.ts`, 8 tests). CLEAR sends an engagement draft in the thread; CONFLICT and NEEDS_REVIEW send a hold notice that gives no reason. Twelve fictional matters were seeded with real company numbers so previous-name expansion has real records to find. Verified on the dev deployment: a supplier dispute against a company that was Royal Mail plc until 2022 returns CONFLICT via the company number; a claim against "Timpson" resolves to one entity but returns NEEDS_REVIEW because a similarly named group company is a former client; a retailer instructing against a real logistics company returns CLEAR with the retailer's entity confirmed from its own site. Convex features: queries, mutations, actions, scheduled functions, workflow and workpool components (`convex/intake.ts`, `convex/extract.ts`, `convex/registry.ts`, `convex/resolve.ts`, `convex/letters.ts`, `convex/seed.ts`, `convex/demo.ts`).

### 2026-09-19 - 1c9e539
Intake board, partner review queue and the record page, live on Convex static hosting with app-owned root routing so the webhook path stays at the root. The board subscribes to every prospect and its stage; the review queue lists what the engine refused to clear and records the solicitor's decision beside the verdict without overwriting it; the record page shows each party, its candidates and previous names, the website evidence with URL and time, the verdict reasons, the matched history and the letter. A demo path runs the identical workflow from pasted text and records the letter instead of sending it. Production deployment seeded and receiving the AgentMail webhook. Convex features: realtime queries, queries, mutations (`src/App.tsx`, `convex/board.ts`, `convex/demo.ts`, `vite.config.ts`).
