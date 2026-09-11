import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySessionToken } from "./jwt";
import { ROLE_LANDING, ROLE_PERMISSIONS, type Permission } from "./rbac";

export { SESSION_COOKIE };

export type Session = {
  tenantId: string;
  tenantName: string;
  userId: string;
  name: string;
  email: string;
  title: string;
  role: SessionRole;
  permissions: Permission[];
  landing: string;
  vioTalkMapped: boolean;
  mailbox: string | null;
  recordingPlaybackAllowed: boolean;
};

type SessionRole = "recruiter" | "sales" | "operations" | "leadership" | "admin";

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.user.findFirst({
    where: { id: claims.userId, tenantId: claims.tenantId, enabled: true },
    include: {
      memberships: true,
      agentMap: true,
      mailboxMap: true,
      tenant: { include: { settings: true } },
    },
  });
  if (!user || !user.tenant.enabled) return null;
  const membership = user.memberships[0];
  if (!membership) return null;

  const role = membership.role as SessionRole;
  const permissions = Array.from(
    new Set([...ROLE_PERMISSIONS[role], ...(membership.permissions as Permission[])]),
  );

  return {
    tenantId: user.tenantId,
    tenantName: user.tenant.name,
    userId: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    role,
    permissions,
    landing: ROLE_LANDING[role],
    vioTalkMapped: Boolean(user.agentMap),
    mailbox: user.mailboxMap?.mailbox ?? null,
    recordingPlaybackAllowed: user.tenant.settings?.recordingPlaybackAllowed ?? false,
  };
}

export function requirePermission(session: Session, permission: Permission) {
  return session.permissions.includes(permission);
}
