import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { hashToken, newSecretToken } from "./password";

export type PasswordMailKind = "invite" | "reset" | "forgot";

const EXPIRY_HOURS: Record<PasswordMailKind, number> = {
  invite: 48,
  reset: 24,
  forgot: 24,
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
  return "http://localhost:3011";
}

async function deliver(input: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  stubLabel: string;
}) {
  const lines = [`Hi ${input.name},`, "", input.intro, ""];
  if (input.ctaUrl) {
    lines.push(`${input.ctaLabel || "Open link"}: ${input.ctaUrl}`, "");
  }
  if (input.footer) lines.push(input.footer, "");
  lines.push("If you did not expect this email, ignore it.");

  const htmlParts = [
    `<p>Hi ${escapeHtml(input.name)},</p>`,
    `<p>${escapeHtml(input.intro)}</p>`,
  ];
  if (input.ctaUrl) {
    htmlParts.push(
      `<p><a href="${escapeHtml(input.ctaUrl)}">${escapeHtml(input.ctaLabel || "Open link")}</a></p>`,
    );
  }
  if (input.footer) htmlParts.push(`<p>${escapeHtml(input.footer)}</p>`);
  htmlParts.push("<p>If you did not expect this email, ignore it.</p>");

  const delivery = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: lines.join("\n"),
    html: htmlParts.join("\n"),
  });
  if (delivery.stub) {
    console.info(`[sendgrid-stub] ${input.stubLabel}`, {
      to: input.to,
      subject: input.subject,
      url: input.ctaUrl,
    });
  }
  return delivery;
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
      passwordResetKind: input.kind === "forgot" ? "reset" : input.kind,
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
      : input.kind === "forgot"
        ? `A password reset was requested for your TalentBridge account at ${input.tenantName}.`
        : `${input.actorName} requested a password reset for your TalentBridge account at ${input.tenantName}.`;

  const delivery = await deliver({
    to: user.email,
    name: user.name,
    subject,
    intro,
    ctaLabel: "Set your password",
    ctaUrl: url,
    footer: `This link expires in ${hours} hours.`,
    stubLabel: "password link",
  });

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

/** Always returns the same shape — does not reveal whether the email exists. */
export async function requestForgotPassword(emailRaw: string, origin?: string | null) {
  const email = String(emailRaw || "").trim().toLowerCase();
  const generic = {
    ok: true as const,
    message: "If that email is registered, a reset link has been sent.",
  };
  if (!email || !email.includes("@")) return generic;

  const users = await prisma.user.findMany({
    where: {
      email,
      enabled: true,
      tenant: { enabled: true },
    },
    include: { tenant: true },
    take: 5,
  });

  const baseUrl = appBaseUrl(origin);
  for (const user of users) {
    try {
      await issuePasswordEmail({
        userId: user.id,
        tenantId: user.tenantId,
        kind: "forgot",
        actorName: "TalentBridge",
        tenantName: user.tenant.name,
        baseUrl,
      });
    } catch {
      /* keep generic response */
    }
  }
  return generic;
}

export async function sendPasswordChangedEmail(user: {
  id: string;
  email: string;
  name: string;
  tenantId: string;
}) {
  try {
    await deliver({
      to: user.email,
      name: user.name,
      subject: "Your TalentBridge password was changed",
      intro: "Your TalentBridge password was set or changed successfully. If you did not do this, contact your administrator immediately.",
      stubLabel: "password-changed",
    });
  } catch (error) {
    console.error("[sendgrid] password-changed notice failed", error);
  }
}

export async function sendUserDisabledEmail(user: {
  email: string;
  name: string;
  tenantName: string;
}) {
  try {
    await deliver({
      to: user.email,
      name: user.name,
      subject: `Your TalentBridge access was disabled (${user.tenantName})`,
      intro: `Your TalentBridge account for ${user.tenantName} has been disabled. You can no longer sign in. Contact your administrator if you believe this is a mistake.`,
      stubLabel: "user-disabled",
    });
  } catch (error) {
    console.error("[sendgrid] user-disabled notice failed", error);
  }
}
