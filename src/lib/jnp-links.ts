/**
 * JobsNProfiles deep-link / preview security helpers.
 * Keeps Open JobsNProfiles on allowlisted https hosts only.
 */

const DEFAULT_ALLOWED_HOSTS = [
  "jobsnprofiles.com",
  "www.jobsnprofiles.com",
  "admin.jobsnprofiles.com",
  "api.jobsnprofiles.com",
];

function allowedHosts(): string[] {
  const extra = String(process.env.NEXT_PUBLIC_JNP_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...extra])];
}

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts().some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Strip JNP- prefix; keep digits/safe path segment only. */
export function normalizeJnpPortalId(raw: unknown): string {
  const id = String(raw ?? "")
    .trim()
    .replace(/^JNP-/i, "");
  if (!id) return "";
  // Portal ids are numeric user ids in JNP; reject anything odd.
  if (!/^\d{1,20}$/.test(id)) return "";
  return id;
}

/**
 * Build a safe https deep-link for Open JobsNProfiles.
 * Returns "" if base/id would produce an unsafe or invalid URL.
 */
export function buildJnpProfileUrl(portalCandidateId: unknown): string {
  const id = normalizeJnpPortalId(portalCandidateId);
  if (!id) return "";

  const configured = String(process.env.NEXT_PUBLIC_JNP_PROFILE_BASE_URL || "https://jobsnprofiles.com/employer/candidate-profile").trim();
  if (!configured) return "";

  let candidate = configured;
  if (candidate.includes("{id}")) {
    candidate = candidate.replace(/\{id\}/g, encodeURIComponent(id));
  } else {
    candidate = `${candidate.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return "";
  }

  if (url.protocol !== "https:") return "";
  if (!hostAllowed(url.hostname)) return "";
  // Block credentials / dangerous schemes already covered by https + host allowlist
  if (url.username || url.password) return "";

  return url.toString();
}

/** Safe Content-Disposition filename (no path separators / quotes). */
export function safeContentDispositionFileName(name: string): string {
  const base = String(name || "resume")
    .replace(/[\r\n"\\]/g, "")
    .replace(/[\/\\]/g, "_")
    .trim()
    .slice(0, 180);
  return base || "resume";
}
