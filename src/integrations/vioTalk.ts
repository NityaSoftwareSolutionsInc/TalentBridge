import type { VioTalkAdapter, VioTalkCallRequest, VioTalkCallResult } from "./types";

export type VioTalkDialResult = {
  status: "dialing" | "fallback" | "stub";
  accepted: boolean;
  fallbackUrl?: string;
  message?: string;
  destination?: string;
  /** Present only for stub / sync completion (legacy). */
  completed?: VioTalkCallResult;
};

function envConfig() {
  return {
    apiBaseUrl: (process.env.VIOTALK_API_BASE_URL || "").trim().replace(/\/$/, ""),
    partnerApiKey: (process.env.VIOTALK_PARTNER_API_KEY || "").trim(),
  };
}

export function isVioTalkLiveConfigured(settings?: {
  viotalkApiBaseUrl?: string;
  viotalkPartnerApiKey?: string;
}): boolean {
  const env = envConfig();
  const base = (settings?.viotalkApiBaseUrl || env.apiBaseUrl).trim();
  const key = (settings?.viotalkPartnerApiKey || env.partnerApiKey).trim();
  return Boolean(base && key);
}

export async function remoteDial(input: {
  apiBaseUrl: string;
  partnerApiKey: string;
  agentUserId: string;
  destination: string;
  correlationId: string;
  displayName?: string;
  externalTenantId?: string;
}): Promise<VioTalkDialResult> {
  const base = input.apiBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/partner/remote-dial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.partnerApiKey}`,
    },
    body: JSON.stringify({
      agentUserId: input.agentUserId,
      destination: input.destination,
      correlationId: input.correlationId,
      displayName: input.displayName,
      externalTenantId: input.externalTenantId,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    accepted?: boolean;
    delivered?: string;
    fallbackUrl?: string;
    code?: string;
  };

  if (res.status === 202 || (res.ok && data.accepted === false)) {
    return {
      status: "fallback",
      accepted: false,
      fallbackUrl: data.fallbackUrl,
      message:
        data.message ||
        data.error ||
        "Open VioTalk and wait until Registered, then try again.",
      destination: input.destination,
    };
  }

  if (!res.ok) {
    const err = new Error(data.error || data.message || `VioTalk dial failed (${res.status})`);
    (err as Error & { fallbackUrl?: string; code?: string }).fallbackUrl = data.fallbackUrl;
    (err as Error & { code?: string }).code = data.code;
    throw err;
  }

  return {
    status: "dialing",
    accepted: true,
    message: data.message || "Calling on VioTalk…",
    destination: input.destination,
    fallbackUrl: data.fallbackUrl,
  };
}

/** Legacy stub for demos when partner API is not configured. */
export const vioTalkStub: VioTalkAdapter = {
  async placeCall(req: VioTalkCallRequest) {
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
