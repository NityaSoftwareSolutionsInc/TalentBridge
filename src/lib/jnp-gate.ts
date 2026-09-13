import { takeRateLimit } from "./rate-limit";
import {
  jnpAccessDeniedMessage,
  packageEndDateExpired,
  refreshJnpAccessForUser,
  type JnpAccessSnapshot,
} from "./jnp-access";

/** Re-check JobsNProfiles entitlement this often (login snapshot is not forever). */
export const JNP_ACCESS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const SYNC_USER_LIMIT = 30;
const SYNC_TENANT_LIMIT = 200;
const PREVIEW_USER_LIMIT = 60;
const PREVIEW_TENANT_LIMIT = 400;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function isJnpAccessStale(checkedAt: Date | string | null | undefined) {
  if (!checkedAt) return true;
  const ms = checkedAt instanceof Date ? checkedAt.getTime() : Date.parse(String(checkedAt));
  if (!Number.isFinite(ms)) return true;
  return Date.now() - ms > JNP_ACCESS_TTL_MS;
}

export type JnpSessionGate = {
  userId: string;
  tenantId: string;
  jnpAllowed: boolean;
  jnpEnabled: boolean;
  jnpUserId: string | null;
  jnpAccessOk: boolean;
  jnpAccessCode: string;
  jnpPackageEndDate: string;
  jnpCheckedAt: string | null;
};

export async function ensureJnpCaller(session: JnpSessionGate): Promise<{ requesterUserId: string }> {
  if (!session.jnpAllowed) {
    throw new Error(jnpAccessDeniedMessage("tenant_not_allowed"));
  }
  if (!session.jnpEnabled) {
    throw new Error("JobsNProfiles is disabled for your account.");
  }
  const requesterUserId = String(session.jnpUserId || "").trim();
  if (!requesterUserId) {
    throw new Error(jnpAccessDeniedMessage("not_mapped"));
  }
  if (packageEndDateExpired(session.jnpPackageEndDate)) {
    throw new Error(jnpAccessDeniedMessage("subscription_inactive"));
  }

  let ok = session.jnpAccessOk;
  let code = session.jnpAccessCode;
  let packageEndDate = session.jnpPackageEndDate;

  if (isJnpAccessStale(session.jnpCheckedAt)) {
    const snap: JnpAccessSnapshot = await refreshJnpAccessForUser(session.userId);
    ok = snap.ok;
    code = snap.code;
    packageEndDate = snap.packageEndDate;
  }

  if (packageEndDateExpired(packageEndDate)) {
    throw new Error(jnpAccessDeniedMessage("subscription_inactive"));
  }
  if (!ok) {
    throw new Error(jnpAccessDeniedMessage(code || "error"));
  }
  return { requesterUserId };
}

export function assertJnpSyncRateLimit(session: { userId: string; tenantId: string }) {
  const user = takeRateLimit(`jnp:sync:user:${session.userId}`, SYNC_USER_LIMIT, WINDOW_MS);
  if (!user.ok) {
    throw new Error(
      `Too many JobsNProfiles syncs. Try again in about ${user.retryAfterSec}s.`,
    );
  }
  const tenant = takeRateLimit(`jnp:sync:tenant:${session.tenantId}`, SYNC_TENANT_LIMIT, WINDOW_MS);
  if (!tenant.ok) {
    throw new Error(
      `This organization has hit the JobsNProfiles sync limit. Try again in about ${tenant.retryAfterSec}s.`,
    );
  }
}

export function assertJnpPreviewRateLimit(session: { userId: string; tenantId: string }) {
  const user = takeRateLimit(`jnp:preview:user:${session.userId}`, PREVIEW_USER_LIMIT, WINDOW_MS);
  if (!user.ok) {
    throw new Error(
      `Too many JobsNProfiles resume previews. Try again in about ${user.retryAfterSec}s.`,
    );
  }
  const tenant = takeRateLimit(`jnp:preview:tenant:${session.tenantId}`, PREVIEW_TENANT_LIMIT, WINDOW_MS);
  if (!tenant.ok) {
    throw new Error(
      `This organization has hit the JobsNProfiles preview limit. Try again in about ${tenant.retryAfterSec}s.`,
    );
  }
}
