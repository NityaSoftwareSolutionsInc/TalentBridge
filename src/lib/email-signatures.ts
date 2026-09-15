import { prisma } from "./db";
import { audit } from "./audit";
import type { Session } from "./auth";
import { MAX_EMAIL_SIGNATURE_CHARS, looksLikeHtml, sanitizeSignatureHtml } from "./email-signature-html";

export const MAX_EMAIL_SIGNATURES = 10;
export { MAX_EMAIL_SIGNATURE_CHARS };

export type EmailSignatureDto = {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
};

function requireAdmin(session: Session) {
  if (!session.permissions.includes("admin") && session.role !== "admin") {
    throw new Error("Administrator permission required");
  }
}

function mapSig(s: { id: string; name: string; body: string; isDefault: boolean }): EmailSignatureDto {
  return { id: s.id, name: s.name, body: s.body, isDefault: s.isDefault };
}

export async function listEmailSignatures(tenantId: string, userId: string): Promise<EmailSignatureDto[]> {
  const rows = await prisma.emailSignature.findMany({
    where: { tenantId, userId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(mapSig);
}

/** One-time backfill from legacy User.emailSignature* columns. */
export async function migrateLegacyEmailSignature(user: {
  id: string;
  tenantId: string;
  emailSignatureName?: string | null;
  emailSignatureBody?: string | null;
}): Promise<EmailSignatureDto[]> {
  const existing = await prisma.emailSignature.count({ where: { userId: user.id, tenantId: user.tenantId } });
  if (existing > 0) return listEmailSignatures(user.tenantId, user.id);

  const body = String(user.emailSignatureBody || "").trim();
  if (!body) return [];

  const created = await prisma.emailSignature.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      name: String(user.emailSignatureName || "Default").trim().slice(0, 80) || "Default",
      body: String(user.emailSignatureBody || "").slice(0, MAX_EMAIL_SIGNATURE_CHARS),
      isDefault: true,
    },
  });
  return [mapSig(created)];
}

async function assertTargetUser(session: Session, userId: string) {
  const isSelf = userId === session.userId;
  if (!isSelf) requireAdmin(session);
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId: session.tenantId },
  });
  if (!user) throw new Error("User not found in this tenant");
  return user;
}

async function clearOtherDefaults(tenantId: string, userId: string, keepId: string) {
  await prisma.emailSignature.updateMany({
    where: { tenantId, userId, id: { not: keepId }, isDefault: true },
    data: { isDefault: false },
  });
}

export async function upsertEmailSignature(
  session: Session,
  input: {
    id?: string;
    userId?: string;
    name?: string;
    body?: string;
    isDefault?: boolean;
  },
) {
  const targetUserId = String(input.userId || session.userId).trim();
  await assertTargetUser(session, targetUserId);

  const name = String(input.name ?? "Default").trim().slice(0, 80) || "Default";
  let body = String(input.body ?? "");
  if (body.length > MAX_EMAIL_SIGNATURE_CHARS) {
    throw new Error(`Signature must be ${MAX_EMAIL_SIGNATURE_CHARS} characters or fewer`);
  }
  if (looksLikeHtml(body)) body = sanitizeSignatureHtml(body);

  const existingId = String(input.id || "").trim();
  if (existingId) {
    const current = await prisma.emailSignature.findFirst({
      where: { id: existingId, tenantId: session.tenantId, userId: targetUserId },
    });
    if (!current) throw new Error("Signature not found");

    const makeDefault = input.isDefault === true || current.isDefault;
    const updated = await prisma.emailSignature.update({
      where: { id: current.id },
      data: {
        name,
        body,
        isDefault: makeDefault,
      },
    });
    if (makeDefault) await clearOtherDefaults(session.tenantId, targetUserId, updated.id);

    await audit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "upsert_email_signature",
      entityType: "email_signature",
      entityId: updated.id,
      before: { name: current.name, isDefault: current.isDefault, bodyLength: current.body.length },
      after: { name: updated.name, isDefault: updated.isDefault, bodyLength: updated.body.length },
    });

    return {
      userId: targetUserId,
      signature: mapSig(updated),
      signatures: await listEmailSignatures(session.tenantId, targetUserId),
    };
  }

  const count = await prisma.emailSignature.count({
    where: { tenantId: session.tenantId, userId: targetUserId },
  });
  if (count >= MAX_EMAIL_SIGNATURES) {
    throw new Error(`You can save up to ${MAX_EMAIL_SIGNATURES} signatures`);
  }

  const makeDefault = count === 0 || input.isDefault === true;
  const created = await prisma.emailSignature.create({
    data: {
      tenantId: session.tenantId,
      userId: targetUserId,
      name,
      body,
      isDefault: makeDefault,
    },
  });
  if (makeDefault) await clearOtherDefaults(session.tenantId, targetUserId, created.id);

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "upsert_email_signature",
    entityType: "email_signature",
    entityId: created.id,
    after: { name: created.name, isDefault: created.isDefault, bodyLength: created.body.length },
  });

  return {
    userId: targetUserId,
    signature: mapSig(created),
    signatures: await listEmailSignatures(session.tenantId, targetUserId),
  };
}

export async function setDefaultEmailSignature(session: Session, input: { id: string; userId?: string }) {
  const targetUserId = String(input.userId || session.userId).trim();
  await assertTargetUser(session, targetUserId);

  const current = await prisma.emailSignature.findFirst({
    where: { id: String(input.id || "").trim(), tenantId: session.tenantId, userId: targetUserId },
  });
  if (!current) throw new Error("Signature not found");

  const updated = await prisma.emailSignature.update({
    where: { id: current.id },
    data: { isDefault: true },
  });
  await clearOtherDefaults(session.tenantId, targetUserId, updated.id);

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "set_default_email_signature",
    entityType: "email_signature",
    entityId: updated.id,
    after: { name: updated.name, isDefault: true },
  });

  return {
    userId: targetUserId,
    signature: mapSig({ ...updated, isDefault: true }),
    signatures: await listEmailSignatures(session.tenantId, targetUserId),
  };
}

export async function deleteEmailSignature(session: Session, input: { id: string; userId?: string }) {
  const targetUserId = String(input.userId || session.userId).trim();
  await assertTargetUser(session, targetUserId);

  const current = await prisma.emailSignature.findFirst({
    where: { id: String(input.id || "").trim(), tenantId: session.tenantId, userId: targetUserId },
  });
  if (!current) throw new Error("Signature not found");

  await prisma.emailSignature.delete({ where: { id: current.id } });

  if (current.isDefault) {
    const next = await prisma.emailSignature.findFirst({
      where: { tenantId: session.tenantId, userId: targetUserId },
      orderBy: { updatedAt: "desc" },
    });
    if (next) {
      await prisma.emailSignature.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "delete_email_signature",
    entityType: "email_signature",
    entityId: current.id,
    before: { name: current.name, isDefault: current.isDefault, bodyLength: current.body.length },
  });

  return {
    userId: targetUserId,
    deletedId: current.id,
    signatures: await listEmailSignatures(session.tenantId, targetUserId),
  };
}
