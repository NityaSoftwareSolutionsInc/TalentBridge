import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = (await req.json()) as { userId?: string; email?: string; password?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (email && password) {
    const user = await prisma.user.findFirst({
      where: { email, enabled: true },
      include: { memberships: true },
    });
    const role = user?.memberships[0]?.role;
    const ok = user && role && (await verifyPassword(password, user.passwordHash));
    if (!ok || !user || !role) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const token = await signSessionToken({ userId: user.id, tenantId: user.tenantId, role });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  }

  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "Email and password, or a demo user, are required" }, { status: 400 });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true },
  });
  if (!user || !user.enabled) return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  const role = user.memberships[0]?.role;
  if (!role) return NextResponse.json({ error: "No role on user" }, { status: 403 });

  const token = await signSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
