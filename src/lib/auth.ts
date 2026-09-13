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
  jnpUserId: string | null;
  jnpEnabled: boolean;
  jnpAllowed: boolean;
  outlookAllowed: boolean;
  viotalkAllowed: boolean;
  jnpAccessOk: boolean;
  jnpAccessCode: string;
  jnpPackageEndDate: string;
  jnpCheckedAt: string | null;
  emailSignatures: { id: string; name: string; body: string; isDefault: boolean }[];
  emailSignatureName: string;
  emailSignatureBody: string;
  emailSignatureEnabled: boolean;
  recordingPlaybackAllowed: boolean;
  supportMode: null | { readOnly: true; platformAdminId: string };
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
      jnpMap: true,
      emailSignatures: { orderBy: [{ isDefault: "desc" }, { name: "asc" }] },
      tenant: { include: { settings: true } },
    },
  });
  if (!user || !user.tenant.enabled) return null;
  if (user.tenant.maintenanceMode && !claims.supportReadOnly) return null;
  const membership = user.memberships[0];
  if (!membership) return null;

  const role = membership.role as SessionRole;
  const permissions = Array.from(
    new Set([...ROLE_PERMISSIONS[role], ...(membership.permissions as Permission[])]),
  );

  let signatures = user.emailSignatures.map((s) => ({
    id: s.id,
    name: s.name,
    body: s.body,
    isDefault: s.isDefault,
  }));
  if (!signatures.length && String(user.emailSignatureBody || "").trim()) {
    const { migrateLegacyEmailSignature } = await import("./email-signatures");
    signatures = await migrateLegacyEmailSignature(user);
  }
  const defaultSig = signatures.find((s) => s.isDefault) || signatures[0] || null;
  const outlookAllowed = Boolean(user.tenant.outlookAllowed);
  const viotalkAllowed = Boolean(user.tenant.viotalkAllowed);

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
    vioTalkMapped: viotalkAllowed ? Boolean(user.agentMap) : false,
    mailbox: outlookAllowed ? user.mailboxMap?.mailbox ?? null : null,
    jnpUserId: user.jnpMap?.jnpUserId || user.tenant.settings?.jnpAccountUserId || null,
    jnpEnabled: Boolean(user.jnpEnabled) && Boolean(user.tenant.jnpAllowed),
    jnpAllowed: Boolean(user.tenant.jnpAllowed),
    outlookAllowed,
    viotalkAllowed,
    jnpAccessOk: Boolean(user.jnpAccessOk) && Boolean(user.tenant.jnpAllowed),
    jnpAccessCode: String(user.jnpAccessCode || ""),
    jnpPackageEndDate: String(user.jnpPackageEndDate || ""),
    jnpCheckedAt: user.jnpCheckedAt ? user.jnpCheckedAt.toISOString() : null,
    emailSignatures: signatures,
    emailSignatureName: defaultSig?.name || "Default",
    emailSignatureBody: defaultSig?.body || "",
    emailSignatureEnabled: Boolean(defaultSig?.body?.trim()),
    recordingPlaybackAllowed: user.tenant.settings?.recordingPlaybackAllowed ?? false,
    supportMode:
      claims.supportReadOnly && claims.supportPlatformAdminId
        ? { readOnly: true, platformAdminId: claims.supportPlatformAdminId }
        : null,
  };
}

export function requirePermission(session: Session, permission: Permission) {
  return session.permissions.includes(permission);
}
