/** Resolve a browser-reachable public origin (never Docker bind hosts like 0.0.0.0). */

function hostnameOf(hostOrUrl: string): string {
  try {
    if (hostOrUrl.includes("://")) return new URL(hostOrUrl).hostname;
    return hostOrUrl.split(":")[0] || "";
  } catch {
    return hostOrUrl.split(":")[0] || "";
  }
}

function isBindHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return !h || h === "0.0.0.0" || h === "::";
}

/**
 * Public site origin for redirects and OAuth redirect_uri.
 * Prefer APP_BASE_URL, then forwarded Host headers, then a usable req URL origin.
 */
export function resolvePublicOrigin(req?: Request | null): string {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) {
    try {
      if (!isBindHostname(new URL(configured).hostname)) return configured;
    } catch {
      /* fall through */
    }
  }

  if (req) {
    const xfHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const hostHeader = req.headers.get("host")?.split(",")[0]?.trim();
    const host = xfHost || hostHeader || "";
    if (host && !isBindHostname(hostnameOf(host))) {
      const xfProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const hostName = hostnameOf(host);
      const proto =
        xfProto ||
        (hostName === "localhost" || hostName === "127.0.0.1" ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }

    try {
      const u = new URL(req.url);
      if (!isBindHostname(u.hostname)) return u.origin;
    } catch {
      /* fall through */
    }
  }

  return "http://localhost:3011";
}
