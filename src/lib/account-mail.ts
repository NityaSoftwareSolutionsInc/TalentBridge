import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { hashToken, newSecretToken } from "./password";

export type PasswordMailKind = "invite" | "reset";

const EXPIRY_HOURS: Record<PasswordMailKind, number> = {
  invite: 48,
  reset: 24,
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch] || ch;
  });
}

export function appBaseUrl(originHeader?: string | null) {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (originHeader) return originHeader.replace(/\/$/, "");
  return "http://localhost:3001";
}

export async function issuePasswordEmail(input: {
  userId: string;
  tenantId: string;
  kind: PasswordMailKind;
  actorName: string;
  tenantName: string;
  baseUrl: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
  });
  if (!user) throw new Error("User not found in this tenant");
  if (!user.enabled) throw new Error("Cannot email a disabled user");

  const token = newSecretToken();
  const hours = EXPIRY_HOURS[input.kind];
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  const url = `${input.baseUrl}/set-password?token=${encodeURIComponent(token)}`;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: expires,
      passwordResetKind: input.kind,
      inviteSentAt: input.kind === "invite" ? new Date() : user.inviteSentAt,
    },
  });

  const subject =
    input.kind === "invite"
      ? `You're invited to TalentBridge (${input.tenantName})`
      : `Reset your TalentBridge password`;
  const intro =
    input.kind === "invite"
      ? `${input.actorName} invited you to TalentBridge as a ${input.tenantName} user. Set your password to sign in.`
      : `An administrator requested a password reset for your TalentBridge account.`;
  const text = [
    `Hi ${user.name},`,
    "",
    intro,
    "",
    `Set your password: ${url}`,
    `This link expires in ${hours} hours.`,
    "",
    "If you did not expect this email, ignore it.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(user.name)},</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(url)}">Set your password</a></p>
<p>This link expires in ${hours} hours.</p>
<p>If you did not expect this email, ignore it.</p>`;

  const delivery = await sendTransactionalEmail({
    to: user.email,
    subject,
    text,
    html,
  });

  if (delivery.stub) {
    console.info("[sendgrid-stub] password link", { to: user.email, kind: input.kind, url });
  }

  return {
    userId: user.id,
    email: user.email,
    kind: input.kind,
    sent: delivery.sent,
    stub: delivery.stub,
    configured: sendgridConfigured(),
    previewUrl: delivery.stub ? url : undefined,
  };
}
