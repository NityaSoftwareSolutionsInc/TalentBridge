import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken, verifySupportAccessToken } from "@/lib/jwt";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const claims = await verifySupportAccessToken(token);
  if (!claims) {
    return NextResponse.redirect(new URL("/login?error=support", req.url));
  }

  const user = await prisma.user.findFirst({
    where: {
      id: claims.userId,
      tenantId: claims.tenantId,
      enabled: true,
    },
    include: { memberships: true, tenant: true },
  });
  const role = user?.memberships[0]?.role;
  if (!user || !role || !user.tenant.enabled) {
    return NextResponse.redirect(new URL("/login?error=support", req.url));
  }

  const sessionToken = await signSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role,
    supportReadOnly: true,
    supportPlatformAdminId: claims.platformAdminId,
  });

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(60 * 30));
  return res;
}
