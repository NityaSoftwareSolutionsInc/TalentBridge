import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/jwt";
import { resolvePublicOrigin } from "@/lib/public-origin";

function signedOutResponse(req: Request, asRedirect: boolean) {
  const origin = resolvePublicOrigin(req);
  const res = asRedirect
    ? NextResponse.redirect(new URL("/login?signedOut=1", origin))
    : NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

async function recordLogout() {
  const session = await getSession();
  if (!session) return;
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "logout",
    entityType: "session",
    entityId: session.userId,
  });
}

export async function POST(req: Request) {
  await recordLogout();
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  return signedOutResponse(req, false);
}

export async function GET(req: Request) {
  await recordLogout();
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  return signedOutResponse(req, true);
}
