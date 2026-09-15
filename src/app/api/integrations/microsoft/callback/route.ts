import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  exchangeAuthorizationCode,
  oauthStateCookieName,
  persistOutlookConnection,
  verifyOAuthState,
} from "@/integrations/microsoftOAuth";
import { audit } from "@/lib/audit";

function settingsRedirect(origin: string, query: Record<string, string>) {
  const url = new URL("/settings", origin);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description") || "";

  const clearState = (res: NextResponse) => {
    res.cookies.set(oauthStateCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  };

  if (error) {
    return clearState(
      NextResponse.redirect(
        settingsRedirect(origin, { outlook: "error", reason: errorDescription || error }),
      ),
    );
  }

  const session = await getSession();
  if (!session) {
    return clearState(NextResponse.redirect(new URL("/login", origin)));
  }

  const jar = await cookies();
  const stateCookie = jar.get(oauthStateCookieName())?.value || "";
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return clearState(
      NextResponse.redirect(settingsRedirect(origin, { outlook: "error", reason: "invalid_state" })),
    );
  }

  try {
    const claims = await verifyOAuthState(state);
    if (claims.userId !== session.userId || claims.tenantId !== session.tenantId) {
      return clearState(
        NextResponse.redirect(settingsRedirect(origin, { outlook: "error", reason: "state_mismatch" })),
      );
    }

    const tokens = await exchangeAuthorizationCode({ code, origin });
    await persistOutlookConnection({
      userId: session.userId,
      tenantId: session.tenantId,
      mailbox: tokens.mailbox,
      displayName: tokens.displayName,
      microsoftTenantId: tokens.microsoftTenantId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });

    await audit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "connect_outlook",
      entityType: "mailbox_map",
      entityId: session.userId,
      after: {
        mailbox: tokens.mailbox,
        microsoftTenantId: tokens.microsoftTenantId,
        displayName: tokens.displayName,
      },
    });

    return clearState(
      NextResponse.redirect(settingsRedirect(origin, { outlook: "connected", mailbox: tokens.mailbox })),
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 180) : "connect_failed";
    return clearState(NextResponse.redirect(settingsRedirect(origin, { outlook: "error", reason })));
  }
}
