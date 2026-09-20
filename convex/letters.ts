import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { agentmail } from "./email";

const FIRM = "Hollin & Vance LLP";
const NOTICE = "Conflict Clear is a screening aid. It searches, expands and records; it does not decide. A supervising solicitor reviews every outcome, and no engagement is confirmed until they do.";

// Only CLEAR produces an engagement draft. CONFLICT and NEEDS_REVIEW send a hold notice
// that says nothing about why, because the reason may be a former client's confidence.
// The one model-written paragraph is fetched first; if it fails, the letter goes without it.
export const sendOutcome = internalAction({
  args: { prospectId: v.id("prospects"), verdictId: v.id("verdicts") },
  handler: async (ctx, { prospectId, verdictId }): Promise<{ ref: string; verdict: string }> => {
    const verdict = await ctx.runQuery(internal.letters.getVerdict, { verdictId });
    let paragraph = "";
    if (verdict?.verdict === "CLEAR") {
      try {
        paragraph = await ctx.runAction(internal.extract.draftMatterParagraph, { matterType: verdict.matterType, summary: verdict.summary, verdict: verdict.verdict, parties: verdict.searchedParties });
      } catch { paragraph = ""; }
    }
    return await ctx.runMutation(internal.letters.writeAndSend, { prospectId, verdictId, paragraph });
  },
});

export const getVerdict = internalQuery({
  args: { verdictId: v.id("verdicts") },
  handler: (ctx, { verdictId }) => ctx.db.get(verdictId),
});

export const writeAndSend = internalMutation({
  args: { prospectId: v.id("prospects"), verdictId: v.id("verdicts"), paragraph: v.string() },
  handler: async (ctx, { prospectId, verdictId, paragraph }): Promise<{ ref: string; verdict: string }> => {
    const prospect = await ctx.db.get(prospectId);
    const verdict = await ctx.db.get(verdictId);
    if (!prospect || !verdict) throw new Error("prospect or verdict missing");

    const ref = `CC-${verdictId.slice(-6).toUpperCase()}`;
    const text = verdict.verdict === "CLEAR"
      ? [
          `Thank you for your instruction.`,
          ``,
          ...(paragraph ? [paragraph, ``] : []),
          `Our preliminary conflict screen found no match on the firm's records that would stop ${FIRM} from considering this matter (${verdict.matterType}). This is not a confirmation that we can act: a supervising solicitor reviews every screen before any engagement is confirmed, and will send our terms of business if so. Reference: ${ref}.`,
          ``,
          NOTICE,
          ``,
          `${FIRM} — Intake`,
        ].join("\n")
      : [
          `Thank you for your instruction. Before ${FIRM} can confirm whether we are able to act, a supervising solicitor needs to review it. We will come back to you on this thread. Reference: ${ref}.`,
          ``,
          `Please do not send us confidential documents until you hear from us.`,
          ``,
          NOTICE,
          ``,
          `${FIRM} — Intake`,
        ].join("\n");

    // Demo prospects have no real thread; the letter is recorded, not sent.
    if (prospect.inboxId === "demo") {
      await ctx.db.patch(verdictId, { letterText: text });
      return { ref, verdict: verdict.verdict };
    }
    const outboundId = await agentmail.replyToMessage(ctx, prospect.inboxId, prospect.messageId, {
      text,
      labels: ["conflict-clear", verdict.verdict.toLowerCase()],
    });
    await ctx.db.patch(verdictId, { outboundMessageId: String(outboundId), letterText: text });
    return { ref, verdict: verdict.verdict };
  },
});
