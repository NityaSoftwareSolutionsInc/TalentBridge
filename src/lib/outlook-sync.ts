import { prisma } from "@/lib/db";
import { mailboxIsConnected } from "@/integrations/microsoftOAuth";
import { graphConfigured } from "@/integrations/graph";
import { ingestOutlookMail } from "@/lib/queries";
import type { Session } from "@/lib/auth";

/**
 * Background Outlook thread-reply sync after login.
 * Does not block sign-in. Only runs when the tenant allows Outlook and this user
 * has an admin-assigned mailbox connected (or stub mailbox in demo mode).
 */
export async function syncOutlookOnLogin(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, enabled: true },
    include: {
      memberships: true,
      mailboxMap: true,
      tenant: { include: { settings: true } },
    },
  });
  if (!user || !user.tenant.enabled || !user.tenant.outlookAllowed) return;

  const role = user.memberships[0]?.role as Session["role"] | undefined;
  if (!role) return;

  const map = user.mailboxMap;
  if (!map?.mailbox?.trim()) return;
  if (graphConfigured() && !mailboxIsConnected(map)) return;

  // Login sync is always for this user only (even if they are admin).
  const session = {
    tenantId: user.tenantId,
    tenantName: user.tenant.name,
    userId: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    role,
    permissions: [],
    landing: "",
    vioTalkMapped: false,
    mailbox: map.mailbox,
    jnpUserId: null,
    jnpEnabled: false,
    jnpAllowed: Boolean(user.tenant.jnpAllowed),
    outlookAllowed: true,
    viotalkAllowed: Boolean(user.tenant.viotalkAllowed),
    jnpAccessOk: false,
    jnpAccessCode: "",
    jnpPackageEndDate: "",
    jnpCheckedAt: null,
    emailSignatures: [],
    emailSignatureName: "Default",
    emailSignatureBody: "",
    emailSignatureEnabled: false,
    recordingPlaybackAllowed: user.tenant.settings?.recordingPlaybackAllowed ?? false,
    supportMode: null,
  } satisfies Session;

  // Force self-scoped ingest: temporarily treat as non-admin for map selection.
  await ingestOutlookMail({ ...session, role: role === "admin" ? "recruiter" : role });
}
