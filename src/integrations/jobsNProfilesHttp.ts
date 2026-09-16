import type { JobsNProfilesAdapter, JnpProfile } from "./types";

type JnpApiProfileResponse = {
  success?: number;
  found?: boolean;
  portalCandidateId?: string;
  resumeId?: number | string;
  resumeFileName?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  secondaryTitle?: string;
  previousTitles?: string[];
  resumeTitles?: string[];
  skills?: string[];
  location?: string;
  preferredLocation?: string;
  experienceYears?: number;
  availability?: string;
  noticePeriod?: string;
  linkedIn?: string;
  citizenship?: string;
  workAuthorization?: string;
  willingToRelocate?: string;
  employmentType?: string;
  currentRate?: string;
  expectedRate?: string;
  visaExpiry?: string | null;
  timezone?: string;
  error?: string;
};

export function normalizePortalCandidateId(portalCandidateId: string): string {
  return String(portalCandidateId || "")
    .trim()
    .replace(/^JNP-/i, "");
}

export function jnpHttpConfigured(): boolean {
  return Boolean(
    (process.env.JNP_API_BASE_URL || "").trim() && (process.env.JNP_API_KEY || "").trim(),
  );
}

function baseUrl(): string {
  return (process.env.JNP_API_BASE_URL || "").trim().replace(/\/$/, "");
}

function apiKey(): string {
  return (process.env.JNP_API_KEY || "").trim();
}

export class JnpRequestError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.name = "JnpRequestError";
    this.code = code;
  }
}

function looksLikeUpstreamMarkup(text: string) {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<Error") ||
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html")
  );
}

function parseJnpError(res: Response, text: string, fallback: string) {
  let code = "";
  let message = fallback;
  try {
    const data = JSON.parse(text) as { error?: string; code?: string };
    if (data.error) message = data.error;
    if (data.code) code = data.code;
  } catch {
    if (text && !looksLikeUpstreamMarkup(text)) {
      message = `${fallback}: ${text.slice(0, 200)}`;
    }
  }
  if (res.status === 401) return new JnpRequestError("JobsNProfiles API key rejected", "unauthorized");
  if (res.status === 403) {
    if (code === "subscription_inactive") {
      return new JnpRequestError(
        "JobsNProfiles subscription is missing or expired for the mapped employer",
        code,
      );
    }
    if (code === "requester_unknown") {
      return new JnpRequestError("Mapped JobsNProfiles user was not found", code);
    }
    if (code === "requester_disabled") {
      return new JnpRequestError("Mapped JobsNProfiles user is disabled", code);
    }
    return new JnpRequestError(message || "JobsNProfiles denied this requester", code);
  }
  if (res.status === 400 && code === "requester_required") {
    return new JnpRequestError("JobsNProfiles requires an identified employer on this request", code);
  }
  return new JnpRequestError(`${fallback} (${res.status}): ${message}`.slice(0, 240), code);
}

async function jnpPost(path: string, body: Record<string, unknown>, timeoutMs = 20000) {
  return fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function toJnpProfile(data: JnpApiProfileResponse, fallbackId: string): JnpProfile {
  return {
    portalCandidateId: String(data.portalCandidateId || fallbackId),
    resumeId: data.resumeId != null && String(data.resumeId).trim() ? data.resumeId : undefined,
    resumeFileName: String(data.resumeFileName || "").trim() || undefined,
    name: String(data.name || "").trim(),
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    title: String(data.title || "").trim(),
    secondaryTitle: String(data.secondaryTitle || "").trim(),
    previousTitles: Array.isArray(data.previousTitles) ? data.previousTitles.map(String) : [],
    resumeTitles: Array.isArray(data.resumeTitles) ? data.resumeTitles.map(String) : [],
    skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
    location: String(data.location || "").trim(),
    preferredLocation: String(data.preferredLocation || data.location || "").trim(),
    experienceYears: Number.isFinite(Number(data.experienceYears))
      ? Number(data.experienceYears)
      : 0,
    availability: String(data.availability || "").trim(),
    noticePeriod: String(data.noticePeriod || "").trim(),
    linkedIn: String(data.linkedIn || "").trim(),
    citizenship: String(data.citizenship || "").trim(),
    workAuthorization: String(data.workAuthorization || "").trim(),
    willingToRelocate: String(data.willingToRelocate || "").trim(),
    employmentType: String(data.employmentType || "").trim(),
    currentRate: sanitizeSyncedRate(data.currentRate),
    expectedRate: sanitizeSyncedRate(data.expectedRate),
    visaExpiry: data.visaExpiry ? String(data.visaExpiry) : null,
    timezone: String(data.timezone || "").trim(),
  };
}

/** Drop JNP placeholder zeros so TalentBridge keeps rates blank when unknown. */
function sanitizeSyncedRate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\$?\s*0+(\.0+)?(\s*[-–]\s*\$?\s*0+(\.0+)?)?\s*(\/(hr|mo|yr|hour|month|year))?$/i.test(raw)) {
    return "";
  }
  return raw;
}

export const jobsNProfilesHttp: JobsNProfilesAdapter = {
  async authenticate(caller) {
    const requesterUserId = String(caller?.requesterUserId || "").trim();
    if (!requesterUserId) throw new Error("JobsNProfiles requester is required");
    if (!jnpHttpConfigured()) throw new Error("JobsNProfiles is not connected");

    let res: Response;
    try {
      res = await jnpPost("/talentbridge/authenticate", { requester_user_id: requesterUserId }, 8000);
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new JnpRequestError(
        timedOut ? "JobsNProfiles authentication timed out" : "JobsNProfiles could not be reached",
        "error",
      );
    }
    const text = await res.text().catch(() => "");
    if (!res.ok) throw parseJnpError(res, text, "JobsNProfiles authentication failed");

    let data: {
      requester_user_id?: string;
      admin_user_id?: string;
      email?: string;
      plan?: string;
      package_end_date?: string | Date | null;
    } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      /* body already consumed as text */
    }
    const packageEndDate = data.package_end_date
      ? String(data.package_end_date).slice(0, 10)
      : null;
    return {
      requesterUserId: String(data.requester_user_id || requesterUserId),
      adminUserId: data.admin_user_id ? String(data.admin_user_id) : undefined,
      email: data.email ? String(data.email) : undefined,
      plan: data.plan ? String(data.plan) : undefined,
      packageEndDate,
      adapter: "live" as const,
    };
  },
  async fetchProfile(portalCandidateId, caller) {
    const userId = normalizePortalCandidateId(portalCandidateId);
    if (!userId) return null;
    if (!jnpHttpConfigured()) return null;
    const requesterUserId = String(caller?.requesterUserId || "").trim();
    if (!requesterUserId) throw new Error("JobsNProfiles requester is required");

    const res = await jnpPost("/talentbridge/get_candidate_profile", {
      candidate_user_id: userId,
      requester_user_id: requesterUserId,
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw parseJnpError(res, text, "JobsNProfiles profile fetch failed");
    }

    const data = (await res.json()) as JnpApiProfileResponse;
    if (!data || data.found === false) return null;
    return toJnpProfile(data, userId);
  },

  async listUpdatedProfiles() {
    return [];
  },

  async fetchResumeFile(input) {
    const userId = normalizePortalCandidateId(input.userId);
    const resumeId = String(input.resumeId || "").trim();
    const fileName = String(input.fileName || "").trim();
    if (!userId || !resumeId || !fileName || !jnpHttpConfigured()) return null;
    if (!/^\d{1,20}$/.test(userId) || !/^\d{1,20}$/.test(resumeId)) return null;
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return null;

    const names = [fileName];
    if (!/\.pdf$/i.test(fileName)) {
      const pdfName = fileName.replace(/\.[^.]+$/, "") + ".pdf";
      if (pdfName && pdfName !== fileName) names.push(pdfName);
    }

    for (const name of names) {
      const res = await fetch(
        `${baseUrl()}/bs/resumes/${encodeURIComponent(userId)}/${encodeURIComponent(resumeId)}/${encodeURIComponent(name)}`,
        { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20000) },
      );
      if (!res.ok) continue;
      const headerType = res.headers.get("content-type") || "";
      if (headerType.includes("application/json") || headerType.includes("text/html")) continue;
      const body = await res.arrayBuffer();
      if (!body.byteLength) continue;
      const head = Buffer.from(body.slice(0, 220)).toString("utf8");
      if (looksLikeUpstreamMarkup(head)) continue;
      const contentType = headerType.split(";")[0].trim() || "application/octet-stream";
      return { fileName: name, contentType, body };
    }
    return null;
  },

  async previewResume(resumeId, caller) {
    const id = String(resumeId || "").trim();
    if (!id || !jnpHttpConfigured()) return null;
    if (!String(caller?.requesterUserId || "").trim()) {
      throw new Error("JobsNProfiles requester is required");
    }
    return null;
  },
};
