import type { VioTalkAdapter } from "./types";

export const vioTalkStub: VioTalkAdapter = {
  async placeCall(req) {
    const callId = `vt-call-${Date.now()}`;
    return {
      callId,
      durationSeconds: 12 * 60,
      recordingRef: `rec:${callId}`,
      transcriptRef: `tr:${callId}`,
      aiSummary: `Spoke with contact ${req.personId}. Interested — follow-up required.`,
      proposedFollowUp: "Send two matching profiles tomorrow",
    };
  },
  async getAgentNumber(vioTalkUserId) {
    if (!vioTalkUserId) return null;
    return "+1-800-555-0199";
  },
};
