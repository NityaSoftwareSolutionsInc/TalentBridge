import type { OutlookAdapter, OutlookMessage } from "./types";

const unmatched: OutlookMessage[] = [
  {
    messageId: "outlook-unmatched-001",
    from: "james.dalton@northstar.example",
    to: ["unknown.hiring@example.com"],
    subject: "Profile for review — no TalentBridge requirement selected",
    sentAt: new Date().toISOString(),
    matched: false,
  },
];

export const outlookStub: OutlookAdapter = {
  async sendAsUser(req) {
    const messageId = `outlook-${Date.now()}`;
    console.info("[outlook-stub] send", { from: req.fromMailbox, to: req.to, subject: req.subject, messageId });
    return { messageId };
  },
  async listUnmatched() {
    return unmatched;
  },
};
