/** Microsoft Graph HTTP client (app-only / client credentials). */

type TokenCache = { token: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

export function graphConfigured(): boolean {
  return Boolean(
    (process.env.MICROSOFT_GRAPH_TENANT_ID || "").trim() &&
      (process.env.MICROSOFT_GRAPH_CLIENT_ID || "").trim() &&
      (process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "").trim(),
  );
}

function tenantId(): string {
  return (process.env.MICROSOFT_GRAPH_TENANT_ID || "").trim();
}

function clientId(): string {
  return (process.env.MICROSOFT_GRAPH_CLIENT_ID || "").trim();
}

function clientSecret(): string {
  return (process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "").trim();
}

function graphBase(): string {
  return (process.env.MICROSOFT_GRAPH_BASE_URL || "https://graph.microsoft.com/v1.0").trim().replace(/\/$/, "");
}

export class GraphError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "GraphError";
    this.status = status;
    this.code = code;
  }
}

async function graphToken(): Promise<string> {
  if (!graphConfigured()) {
    throw new Error(
      "Microsoft Graph is not configured. Set MICROSOFT_GRAPH_TENANT_ID, MICROSOFT_GRAPH_CLIENT_ID and MICROSOFT_GRAPH_CLIENT_SECRET.",
    );
  }
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId())}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new GraphError(
      data.error_description || data.error || `Graph token request failed (${res.status})`,
      res.status,
      data.error,
    );
  }
  const expiresIn = Number(data.expires_in) || 3600;
  tokenCache = { token: data.access_token, expiresAt: now + expiresIn * 1000 };
  return data.access_token;
}

export async function graphFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<{ status: number; data: T }> {
  const token = await graphToken();
  const url = new URL(path.startsWith("http") ? path : `${graphBase()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(init.query || {})) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data = {} as T;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      if (!res.ok) {
        throw new GraphError(text.slice(0, 200) || `Microsoft Graph request failed (${res.status})`, res.status);
      }
    }
  }
  if (!res.ok) {
    const err = data as { error?: { code?: string; message?: string } };
    throw new GraphError(
      err.error?.message || `Microsoft Graph request failed (${res.status})`,
      res.status,
      err.error?.code,
    );
  }
  return { status: res.status, data };
}

export function userPath(mailbox: string): string {
  return `/users/${encodeURIComponent(mailbox.trim())}`;
}

export function asHtml(text: string): string {
  const escaped = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div>${escaped.replace(/\n/g, "<br/>")}</div>`;
}

export function recipient(address: string) {
  return { emailAddress: { address: address.trim() } };
}
