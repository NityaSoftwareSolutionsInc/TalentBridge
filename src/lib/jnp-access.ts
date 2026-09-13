import { integrations } from "@/integrations";
import { JnpRequestError } from "@/integrations/jobsNProfilesHttp";
import { prisma } from "./db";

export type JnpAccessSnapshot = {
  ok: boolean;
  code: string;
  packageEndDate: string;
};

export function codeFromJnpError(error: unknown) {
  const code = error instanceof JnpRequestError && error.code ? error.code : "error";
  const known = ["requester_disabled", "requester_unknown", "subscription_inactive", "requester_required"];
  return known.includes(code) ? code : "error";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function jnpAccessDeniedMessage(code: string) {
  switch (code) {
    case "requester_disabled":
      return "Your JobsNProfiles user is disabled. Sync is blocked until that account is re-enabled in JobsNProfiles, then sign in again.";
    case "requester_unknown":
      return "Mapped JobsNProfiles user was not found. Ask an administrator to re-authenticate the JNP map.";
    case "subscription_inactive":
      return "JobsNProfiles subscription is missing or expired. Renew the package, then sign in again.";
    case "not_mapped":
      return "No JobsNProfiles user mapped. Ask an administrator to map your JNP employer id, or set the tenant JNP account.";
    case "tenant_not_allowed":
      return "JobsNProfiles is not allowed for this organization. A platform administrator must enable it on the tenant.";
    case "disabled_locally":
      return "JobsNProfiles is disabled for your account.";
    case "error":
      return "JobsNProfiles could not be reached at sign-in. Sign in again, or ask an administrator to Authenticate in Settings → JNP map.";
    default:
      return "JobsNProfiles access is not available. Sign in again or ask an administrator to re-authenticate.";
  }
}

export function packageEndDateExpired(packageEndDate: string) {
  const day = String(packageEndDate || "").slice(0, 10);
  return Boolean(day && day < todayIsoDate());
}

async function persist(userId: string, snap: JnpAccessSnapshot): Promise<JnpAccessSnapshot> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      jnpAccessOk: snap.ok,
      jnpAccessCode: snap.code,
      jnpPackageEndDate: snap.packageEndDate,
      jnpCheckedAt: new Date(),
    },
  });
  return snap;
}

export async function storeJnpAccessSnapshot(
  userId: string,
  snap: JnpAccessSnapshot,
): Promise<JnpAccessSnapshot> {
  return persist(userId, snap);
}

export async function stampJnpAccessForUnmappedUsers(tenantId: string, snap: JnpAccessSnapshot) {
  const mapped = await prisma.jnpUserMap.findMany({ where: { tenantId }, select: { userId: true } });
  await prisma.user.updateMany({
    where: {
      tenantId,
      jnpEnabled: true,
      ...(mapped.length ? { id: { notIn: mapped.map((m) => m.userId) } } : {}),
    },
    data: {
      jnpAccessOk: snap.ok,
      jnpAccessCode: snap.code,
      jnpPackageEndDate: snap.packageEndDate,
      jnpCheckedAt: new Date(),
    },
  });
}

const inFlight = new Map<string, Promise<JnpAccessSnapshot>>();

export async function refreshJnpAccessForUser(userId: string): Promise<JnpAccessSnapshot> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const run = (async (): Promise<JnpAccessSnapshot> => {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      include: { jnpMap: true, tenant: { include: { settings: true } } },
    });
    if (!user) {
      return { ok: false, code: "error", packageEndDate: "" };
    }
    if (!user.tenant.jnpAllowed) {
      return persist(user.id, { ok: false, code: "tenant_not_allowed", packageEndDate: "" });
    }
    if (!user.jnpEnabled) {
      return persist(user.id, { ok: false, code: "disabled_locally", packageEndDate: "" });
    }
    const requesterUserId = String(
      user.jnpMap?.jnpUserId || user.tenant.settings?.jnpAccountUserId || "",
    ).trim();
    if (!requesterUserId) {
      return persist(user.id, { ok: false, code: "not_mapped", packageEndDate: "" });
    }

    try {
      const auth = await integrations.jobsNProfiles.authenticate({ requesterUserId });
      const packageEndDate = auth.packageEndDate ? String(auth.packageEndDate).slice(0, 10) : "";
      if (packageEndDateExpired(packageEndDate)) {
        return persist(user.id, { ok: false, code: "subscription_inactive", packageEndDate });
      }
      return persist(user.id, { ok: true, code: "ok", packageEndDate });
    } catch (error) {
      return persist(user.id, {
        ok: false,
        code: codeFromJnpError(error),
        packageEndDate: "",
      });
    }
  })().finally(() => {
    inFlight.delete(userId);
  });

  inFlight.set(userId, run);
  return run;
}

