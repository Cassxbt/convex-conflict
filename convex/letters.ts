import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { agentmail } from "./email";

const FIRM = "Hollin & Vance LLP";
const NOTICE = "Conflict Clear is a screening aid. It searches, expands and records; it does not decide. A supervising solicitor reviews every outcome, and no engagement is confirmed until they do.";

// Only CLEAR produces an engagement draft. CONFLICT and NEEDS_REVIEW send a hold notice
// that says nothing about why, because the reason may be a former client's confidence.
export const sendOutcome = internalMutation({
  args: { prospectId: v.id("prospects"), verdictId: v.id("verdicts") },
  handler: async (ctx, { prospectId, verdictId }) => {
    const prospect = await ctx.db.get(prospectId);
    const verdict = await ctx.db.get(verdictId);
    if (!prospect || !verdict) throw new Error("prospect or verdict missing");

    const ref = `CC-${verdictId.slice(-6).toUpperCase()}`;
    const text = verdict.verdict === "CLEAR"
      ? [
          `Thank you for your instruction. Our intake screen found no conflict of interest that would prevent ${FIRM} acting for you in this matter (${verdict.matterType}).`,
          ``,
          `A supervising solicitor will confirm the engagement and send our terms of business. Reference: ${ref}.`,
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
