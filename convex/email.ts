import { AgentMail } from "@agentmail/convex";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Vendored component: codegen currently omits its internalActions from ComponentApi; runtime has them.
export const agentmail = new AgentMail(components.agentmail as any, {
  onMessageReceived: internal.email.onMessageReceived,
});

// Every inbound prospect email becomes a prospect row. Nothing is decided here;
// the intake workflow is scheduled so the webhook returns fast.
export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  handler: async (ctx, { message }) => {
    // The webhook is org-wide. Only mail that lands in the case inbox is an instruction;
    // anything the case inbox itself sent, or another inbox received, is ignored.
    const caseInbox = process.env.AGENTMAIL_INBOX_ID;
    const from: string = message.from ?? "";
    if (caseInbox && message.inbox_id !== caseInbox) return;
    if (caseInbox && from.includes(caseInbox)) return;
    const senderDomain = from.includes("@") ? from.split("@").pop()!.replace(/>$/, "").toLowerCase() : undefined;
    const existing = await ctx.db
      .query("prospects")
      .withIndex("by_thread", (q) => q.eq("threadId", message.thread_id))
      .first();
    if (existing) return;
    const prospectId = await ctx.db.insert("prospects", {
      inboxId: message.inbox_id,
      threadId: message.thread_id,
      messageId: message.message_id,
      from,
      senderDomain,
      subject: message.subject,
      body: message.text ?? message.extracted_text ?? "",
      receivedAt: Date.now(),
      stage: "received",
    });
    await ctx.scheduler.runAfter(0, internal.intake.startIntake, { prospectId });
  },
});

// Pre-flight: prove outbound replies land in the original thread with delivery tracking.
export const replyInThread = internalMutation({
  args: { prospectId: v.id("prospects"), text: v.string() },
  handler: async (ctx, { prospectId, text }) => {
    const p = await ctx.db.get(prospectId);
    if (!p) throw new Error("prospect not found");
    return agentmail.replyToMessage(ctx, p.inboxId, p.messageId, {
      text,
      labels: ["conflict-clear", "receipt"],
    });
  },
});
