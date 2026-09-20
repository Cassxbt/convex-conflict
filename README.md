# Conflict Clear

Conflict screening for law-firm intake. A prospect emails the firm; every party the email names is resolved to a Companies House entity, using the sender's own website for the names the register cannot see; the firm's matter history is searched, including previous names; and the result is CLEAR, CONFLICT or NEEDS_REVIEW with a written record. Only CLEAR drafts a preliminary letter, and every state waits on the partner queue for a recorded decision.

**Live:** https://descriptive-goldfish-956.convex.site · **Proof:** https://descriptive-goldfish-956.convex.site/#/proof · **Build log:** [hackathon.md](hackathon.md)

Built for the Convex All Gas Hackathon with Convex, AgentMail, Firecrawl and OpenAI.

## The failure it catches

"International Distribution Services Limited" is in no law firm's history. Royal Mail plc is. They are the same company: 08680755 was Royal Mail plc from 2013 to 2022. A keyword conflict search returns nothing. Conflict Clear returns CONFLICT via the company number.

## Judge it in 90 seconds

1. Open the [live site](https://descriptive-goldfish-956.convex.site). The hero card is the latest held record, read live.
2. Press ⌘K (or the search button) and run the **Conflict example**. Watch the record fill in: parties, register candidates with previous names, the verdict with its reasons, the hold notice.
3. Run the **Clear example**. The letter carries one model-written paragraph and says it is preliminary.
4. Try to break it: email a company that does not exist, "Royal Mail" by name only, a sender whose site cannot be read. Each holds.
5. Open [/proof](https://descriptive-goldfish-956.convex.site/#/proof). Every number is a live query; checks say whether they were verified here, reported, or not present.

## Extract → Expand → Compare → Hold or clear

| Step | Who does it | What it produces |
|---|---|---|
| Extract | OpenAI, one bounded structured-output call | parties and sides, no entities, no verdict |
| Expand | Companies House API + Firecrawl on the sender's site | registered candidates with previous names; the brand pinned to its legal entity |
| Compare | `shared/engine.ts`, deterministic, 16 tests | hits by company number and normalised name; weak hits for review |
| Hold or clear | Convex workflow + AgentMail | CLEAR: preliminary letter on the thread; otherwise a hold notice and the partner queue |

The model never sees the matter history. Anything the engine cannot resolve, read, or account for holds the case.

## Five systems, and what breaks without each

- **AgentMail** — the email is the trigger, the sender domain seeds resolution, the reply goes on the same thread. Without it: no front door.
- **Firecrawl** — reads the sender's legal page for the registered number. Without it: a register keyword search for "The Whisky Exchange" returns the wrong company (`scripts/preflight-gate.ts`).
- **Companies House API** — search, profiles, previous names. Not a sponsor; named honestly, nothing is scraped from it.
- **OpenAI** — two bounded calls: party extraction and one neutral letter paragraph. Without it: nothing is extracted and every case holds.
- **Convex** — durable workflow, matter history, verdict record, partner queue, live board, static hosting, webhooks; components: static-hosting, workflow, workpool, rate-limiter, firecrawl, agentmail (vendored, see NOTICE).

## Run it

```bash
npm install
npx convex dev            # creates a deployment; set env vars below in the dashboard or with `npx convex env set`
npx @convex-dev/static-hosting setup
npm run deploy
npm test                  # 16 engine tests
```

Environment: `CH_API_KEY` (Companies House), `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`, `AGENTMAIL_INBOX_ID`, `STAFF_KEY`. Register the AgentMail webhook at `https://<deployment>.convex.site/agentmail/webhook` for `message.received`. Seed the fictional firm with `npx convex run seed:seedMatters`.

## What is real, and what is not

Companies House data, website evidence and the email round trip are real. The firm and its matters are fictional; the company names and numbers in them are real so the register has something to hit. The verdict is deterministic. CLEAR is a recommendation to the supervising solicitor. The console is open so a judge can use it: rate-limited, size-limited, and every record it creates is public. Records that arrive by email are shown by sender domain only and need the staff passphrase to read or review.

## License

MIT. `components/agentmail` is Apache-2.0, vendored from `@agentmail/convex`; see [NOTICE](NOTICE).
