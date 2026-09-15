import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { decryptSecret, encryptSecret } from "@/lib/token-crypto";
import { GraphError } from "./graph";

const OAUTH_SCOPES = [
  "openid",
  "offline_access",
  "profile",
  "email",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
].join(" ");

const STATE_COOKIE = "tb_ms_oauth_state";

export function microsoftOAuthConfigured(): boolean {
  return Boolean(
    (process.env.MICROSOFT_GRAPH_CLIENT_ID || "").trim() &&
      (process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "").trim(),
  );
}

function clientId(): string {
  return (process.env.MICROSOFT_GRAPH_CLIENT_ID || "").trim();
}

function clientSecret(): string {
  return (process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "").trim();
}

/** Multi-tenant org accounts. Override with a single tenant GUID only for locked-down installs. */
function authorityTenant(): string {
  return (process.env.MICROSOFT_GRAPH_AUTHORITY || "organizations").trim() || "organizations";
}

function redirectUri(req?: Request | null): string {
  const explicit = (process.env.MICROSOFT_GRAPH_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  return `${resolvePublicOrigin(req)}/api/integrations/microsoft/callback`;
}

function jwtSecret(): Uint8Array {
  const raw = (process.env.AUTH_JWT_SECRET || process.env.STUB_AUTH_SECRET || "").trim();
  if (!raw) throw new Error("AUTH_JWT_SECRET is required for Microsoft OAuth state");
  return new TextEncoder().encode(raw);
}

export function oauthScopes(): string {
  return OAUTH_SCOPES;
}

export function oauthStateCookieName(): string {
  return STATE_COOKIE;
}

export async function buildConnectUrl(input: {
  userId: string;
  tenantId: string;
  req?: Request | null;
  /** Prefill Microsoft login with the admin-assigned mailbox. */
  loginHint?: string | null;
}): Promise<{ url: string; state: string; redirectUri: string }> {
  if (!microsoftOAuthConfigured()) {
    throw new Error(
      "Microsoft OAuth is not configured. Set MICROSOFT_GRAPH_CLIENT_ID and MICROSOFT_GRAPH_CLIENT_SECRET.",
    );
  }
  const state = await new SignJWT({
    uid: input.userId,
    tid: input.tenantId,
    nonce: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(jwtSecret());

  const redir = redirectUri(input.req);
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redir,
    response_mode: "query",
    scope: OAUTH_SCOPES,
    state,
    prompt: "select_account",
  });
  const hint = String(input.loginHint || "").trim();
  if (hint) params.set("login_hint", hint);
  const url = `https://login.microsoftonline.com/${encodeURIComponent(authorityTenant())}/oauth2/v2.0/authorize?${params}`;
  return { url, state, redirectUri: redir };
}

export async function verifyOAuthState(state: string): Promise<{ userId: string; tenantId: string }> {
  const { payload } = await jwtVerify(state, jwtSecret());
  const userId = String(payload.uid || "");
  const tenantId = String(payload.tid || "");
  if (!userId || !tenantId) throw new Error("Invalid OAuth state");
  return { userId, tenantId };
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(authorityTenant())}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new GraphError(
      data.error_description || data.error || `Microsoft token request failed (${res.status})`,
      res.status,
      data.error,
    );
  }
  return data;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  req?: Request | null;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
  microsoftTenantId: string;
  mailbox: string;
  displayName: string;
}> {
  const data = await tokenRequest(
    new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: redirectUri(input.req),
      scope: OAUTH_SCOPES,
    }),
  );
  const refreshToken = String(data.refresh_token || "");
  if (!refreshToken) {
    throw new Error("Microsoft did not return a refresh token. Ensure offline_access is consented.");
  }
  const idClaims = decodeJwtPayload(data.id_token || "");
  const accessClaims = decodeJwtPayload(data.access_token || "");
  const microsoftTenantId = String(idClaims.tid || accessClaims.tid || "").trim();
  const mailbox = String(
    idClaims.preferred_username || idClaims.email || accessClaims.upn || accessClaims.unique_name || "",
  )
    .trim()
    .toLowerCase();
  const displayName = String(idClaims.name || "").trim();
  if (!mailbox) throw new Error("Could not determine Outlook mailbox from Microsoft sign-in");
  if (!microsoftTenantId) throw new Error("Could not determine Microsoft tenant id from sign-in");

  const expiresIn = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token!,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes: String(data.scope || OAUTH_SCOPES),
    microsoftTenantId,
    mailbox,
    displayName,
  };
}

export function normalizeMailbox(email: string): string {
  return String(email || "").trim().toLowerCase();
}

export function mailboxesMatch(a: string, b: string): boolean {
  return normalizeMailbox(a) === normalizeMailbox(b) && Boolean(normalizeMailbox(a));
}

/**
 * Admin must assign the allowed Outlook mailbox first. OAuth may only connect that exact address.
 * Returns the assigned mailbox, or throws if missing / mismatched.
 */
export async function assertAssignedMailboxForConnect(input: {
  userId: string;
  tenantId: string;
  microsoftMailbox: string;
}): Promise<string> {
  const existing = await prisma.mailboxMap.findFirst({
    where: { userId: input.userId, tenantId: input.tenantId },
  });
  const assigned = normalizeMailbox(existing?.mailbox || "");
  if (!assigned) {
    throw new Error(
      "An administrator must assign your Outlook mailbox in Settings before you can Connect Outlook.",
    );
  }
  const signedIn = normalizeMailbox(input.microsoftMailbox);
  if (!mailboxesMatch(assigned, signedIn)) {
    throw new Error(
      `Microsoft account ${signedIn || "(unknown)"} does not match the assigned mailbox ${assigned}. Sign in with the assigned address only.`,
    );
  }
  return assigned;
}

export async function persistOutlookConnection(input: {
  userId: string;
  tenantId: string;
  mailbox: string;
  displayName: string;
  microsoftTenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}) {
  const assignedMailbox = await assertAssignedMailboxForConnect({
    userId: input.userId,
    tenantId: input.tenantId,
    microsoftMailbox: input.mailbox,
  });

  const data = {
    // Keep admin-assigned spelling; never replace with a different Microsoft account.
    mailbox: assignedMailbox,
    displayName: input.displayName,
    microsoftTenantId: input.microsoftTenantId,
    accessToken: encryptSecret(input.accessToken),
    refreshToken: encryptSecret(input.refreshToken),
    tokenExpiresAt: input.expiresAt,
    scopes: input.scopes,
    connectedAt: new Date(),
  };
  const existing = await prisma.mailboxMap.findFirst({
    where: { userId: input.userId, tenantId: input.tenantId },
  });
  if (existing) {
    return prisma.mailboxMap.update({ where: { id: existing.id }, data });
  }
  return prisma.mailboxMap.create({
    data: { tenantId: input.tenantId, userId: input.userId, ...data },
  });
}

export async function disconnectOutlook(userId: string, tenantId: string) {
  const existing = await prisma.mailboxMap.findFirst({ where: { userId, tenantId } });
  if (!existing) return null;
  // Keep the admin-assigned mailbox; only drop Microsoft tokens.
  return prisma.mailboxMap.update({
    where: { id: existing.id },
    data: {
      microsoftTenantId: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      scopes: "",
      connectedAt: null,
      displayName: "",
    },
  });
}

export function mailboxIsConnected(map: {
  refreshToken?: string | null;
  mailbox?: string | null;
} | null | undefined): boolean {
  return Boolean(map?.refreshToken && String(map.mailbox || "").trim());
}

/** Returns a fresh delegated access token for Graph calls as this TalentBridge user. */
export async function getDelegatedAccessToken(userId: string): Promise<{
  accessToken: string;
  mailbox: string;
  microsoftTenantId: string;
}> {
  const map = await prisma.mailboxMap.findUnique({ where: { userId } });
  if (!map?.refreshToken || !map.mailbox) {
    throw new Error("Outlook is not connected. Connect Outlook in Settings first.");
  }
  const now = Date.now();
  if (map.accessToken && map.tokenExpiresAt && map.tokenExpiresAt.getTime() > now + 60_000) {
    return {
      accessToken: decryptSecret(map.accessToken),
      mailbox: map.mailbox,
      microsoftTenantId: String(map.microsoftTenantId || ""),
    };
  }

  const refreshToken = decryptSecret(map.refreshToken);
  // Refresh against the customer's tenant when known; otherwise multi-tenant authority.
  const tenant = (map.microsoftTenantId || authorityTenant()).trim();
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: OAUTH_SCOPES,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new GraphError(
      data.error_description || data.error || `Microsoft token refresh failed (${res.status})`,
      res.status,
      data.error,
    );
  }
  const expiresIn = Number(data.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const nextRefresh = data.refresh_token ? encryptSecret(data.refresh_token) : map.refreshToken;
  await prisma.mailboxMap.update({
    where: { id: map.id },
    data: {
      accessToken: encryptSecret(data.access_token),
      refreshToken: nextRefresh,
      tokenExpiresAt: expiresAt,
      scopes: String(data.scope || map.scopes || OAUTH_SCOPES),
    },
  });
  return {
    accessToken: data.access_token,
    mailbox: map.mailbox,
    microsoftTenantId: String(map.microsoftTenantId || ""),
  };
}
