/** Microsoft Graph HTTP helpers (delegated multi-tenant OAuth). */

export function graphConfigured(): boolean {
  return Boolean(
    (process.env.MICROSOFT_GRAPH_CLIENT_ID || "").trim() &&
      (process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "").trim(),
  );
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

export async function graphFetchWithToken<T = unknown>(
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<{ status: number; data: T }> {
  const url = new URL(path.startsWith("http") ? path : `${graphBase()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(init.query || {})) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

/** @deprecated Prefer /me with delegated tokens. Kept for any leftover mailbox-path callers. */
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
