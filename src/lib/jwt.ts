import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "tb_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 12;

export type SessionClaims = {
  userId: string;
  tenantId: string;
  role: string;
};

function jwtSecret() {
  const raw = process.env.AUTH_JWT_SECRET || process.env.STUB_AUTH_SECRET || "";
  if (raw.length < 16) {
    throw new Error("AUTH_JWT_SECRET (or STUB_AUTH_SECRET) must be at least 16 characters");
  }
  return new TextEncoder().encode(raw);
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    expires: new Date(0),
  });
}

export async function signSessionToken(claims: SessionClaims) {
  return new SignJWT({
    company_id: claims.tenantId,
    user_id: claims.userId,
    role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(jwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    const userId = String(payload.sub || payload.user_id || "");
    const tenantId = String(payload.company_id || "");
    const role = String(payload.role || "");
    if (!userId || !tenantId) return null;
    return { userId, tenantId, role };
  } catch {
    return null;
  }
}
