import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { refreshJnpAccessForUser } from "@/lib/jnp-access";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";

async function finishLogin(
  user: { id: string; tenantId: string; jnpEnabled: boolean; tenant: { jnpAllowed: boolean } },
  role: string,
  method: string,
) {
  const token = await signSessionToken({ userId: user.id, tenantId: user.tenantId, role });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  // Do not block sign-in on JobsNProfiles. Snapshot refreshes in the background;
  // sync/preview re-check with TTL via ensureJnpCaller.
  if (user.jnpEnabled && user.tenant.jnpAllowed) {
    void refreshJnpAccessForUser(user.id).catch(() => null);
  }
  await audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "login",
    entityType: "session",
    entityId: user.id,
    after: { method },
  });
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { userId?: string; email?: string; password?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (email && password) {
    const user = await prisma.user.findFirst({
      where: { email, enabled: true },
      include: { memberships: true, tenant: true },
    });
    const role = user?.memberships[0]?.role;
    const ok = user && role && (await verifyPassword(password, user.passwordHash));
    if (!ok || !user || !role) {
      if (user) {
        await audit({
          tenantId: user.tenantId,
          actorId: user.id,
          action: "login_failed",
          entityType: "session",
          entityId: user.id,
          after: { method: "password" },
        });
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (!user.tenant.enabled) {
      await audit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: "login_failed",
        entityType: "session",
        entityId: user.id,
        after: { method: "password", reason: "tenant_disabled" },
      });
      return NextResponse.json({ error: "This organization is disabled" }, { status: 403 });
    }
    return finishLogin(user, role, "password");
  }

  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "Email and password, or a demo user, are required" }, { status: 400 });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true, tenant: true },
  });
  if (!user || !user.enabled) return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  if (!user.tenant.enabled) {
    await audit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: "login_failed",
      entityType: "session",
      entityId: user.id,
      after: { method: "demo_picker", reason: "tenant_disabled" },
    });
    return NextResponse.json({ error: "This organization is disabled" }, { status: 403 });
  }
  const role = user.memberships[0]?.role;
  if (!role) return NextResponse.json({ error: "No role on user" }, { status: 403 });

  return finishLogin(user, role, "demo_picker");
}
