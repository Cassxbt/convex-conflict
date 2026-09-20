"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";

// The only thing the model decides is which names appear in the instruction and on which
// side. It never sees matter history and never produces a verdict.
const EXTRACTION_SCHEMA = {
  name: "intake_parties",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      parties: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", description: "Party name exactly as written in the email" },
            side: { type: "string", enum: ["prospect", "adverse", "other"] },
            kind: { type: "string", enum: ["company", "person", "public_body", "unknown"] },
          },
          required: ["name", "side", "kind"],
        },
      },
      matterType: { type: "string" },
      summary: { type: "string", description: "One sentence, factual, no advice" },
    },
    required: ["parties", "matterType", "summary"],
  },
} as const;

export type ExtractedParty = { name: string; side: "prospect" | "adverse" | "other"; kind: "company" | "person" | "public_body" | "unknown" };

export const extractParties = internalAction({
  args: { from: v.string(), subject: v.optional(v.string()), body: v.string() },
  handler: async (_ctx, { from, subject, body }): Promise<{ parties: ExtractedParty[]; matterType: string; summary: string; model: string }> => {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You extract parties from a prospective client's email to a law firm. 'prospect' = the sender or whoever they act for. 'adverse' = whoever they want to act against. Do not infer legal entities, do not correct names, do not add parties not written in the email. One entry per distinct organisation or person: a signature block naming the same organisation as the body is not a second party, and prefixes like 'Legal team,' are not part of the name. If the sender's organisation is only visible in the address or signature, include it once as prospect." },
        { role: "user", content: `From: ${from}\nSubject: ${subject ?? ""}\n\n${body}` },
      ],
      response_format: { type: "json_schema", json_schema: EXTRACTION_SCHEMA },
    });
    const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
    return { ...parsed, model };
  },
});

// Second and last model call: one neutral paragraph restating the matter for the letter. It
// receives the verdict object, never the history, and cannot change the outcome.
export const draftMatterParagraph = internalAction({
  args: { matterType: v.string(), summary: v.string(), verdict: v.string(), parties: v.array(v.string()) },
  handler: async (_ctx, args): Promise<string> => {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You write one short paragraph (max 60 words) for a law firm's intake letter, restating what the prospect asked for in neutral third-person terms. Do not give advice, do not assess merits, do not mention conflicts, do not promise anything, do not name any party other than those listed." },
        { role: "user", content: JSON.stringify(args) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "matter_paragraph", strict: true, schema: { type: "object", additionalProperties: false, properties: { paragraph: { type: "string" } }, required: ["paragraph"] } } },
    });
    return JSON.parse(res.choices[0].message.content ?? "{}").paragraph ?? "";
  },
});
