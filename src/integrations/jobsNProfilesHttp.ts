import type { JobsNProfilesAdapter, JnpProfile } from "./types";

type JnpApiProfileResponse = {
  success?: number;
  found?: boolean;
  portalCandidateId?: string;
  resumeId?: number | string;
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

function toJnpProfile(data: JnpApiProfileResponse, fallbackId: string): JnpProfile {
  return {
    portalCandidateId: String(data.portalCandidateId || fallbackId),
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
    currentRate: String(data.currentRate || "").trim(),
    expectedRate: String(data.expectedRate || "").trim(),
    visaExpiry: data.visaExpiry ? String(data.visaExpiry) : null,
    timezone: String(data.timezone || "").trim(),
  };
}

export const jobsNProfilesHttp: JobsNProfilesAdapter = {
  async fetchProfile(portalCandidateId) {
    const userId = normalizePortalCandidateId(portalCandidateId);
    if (!userId) return null;
    if (!jnpHttpConfigured()) return null;

    const res = await fetch(`${baseUrl()}/talentbridge/get_candidate_profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (res.status === 404) return null;
    if (res.status === 401) {
      throw new Error("JobsNProfiles API key rejected");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`JobsNProfiles profile fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as JnpApiProfileResponse;
    if (!data || data.found === false) return null;
    return toJnpProfile(data, userId);
  },

  async listUpdatedProfiles() {
    return [];
  },
};
