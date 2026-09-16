import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { hashToken, newSecretToken } from "./password";
import { buildTransactionalEmail } from "./email-template";

export type PasswordMailKind = "invite" | "reset" | "forgot";

const EXPIRY_HOURS: Record<PasswordMailKind, number> = {
  invite: 48,
  reset: 24,
  forgot: 24,
};

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
  const { text, html } = buildTransactionalEmail({
    greetingName: input.name,
    intro: input.intro,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    footer: input.footer,
    assetBaseUrl: appBaseUrl(),
  });

  const delivery = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text,
    html,
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
      intro:
        "Your TalentBridge password was set or changed successfully. If you did not do this, contact your administrator immediately.",
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

/** Notify current owner A when B requests transfer/collaboration. */
export async function sendOwnershipRequestEmail(input: {
  toEmail: string;
  toName: string;
  requesterName: string;
  personName: string;
  type: "transfer" | "collaboration";
  note?: string;
  recordUrl: string;
}) {
  const kind = input.type === "transfer" ? "ownership transfer" : "collaboration";
  try {
    await deliver({
      to: input.toEmail,
      name: input.toName,
      subject: `${input.requesterName} requested ${kind} for ${input.personName}`,
      intro: [
        `${input.requesterName} requested ${kind} on ${input.personName}.`,
        input.note ? `Note: ${input.note}` : "",
        "Open TalentBridge to Accept (release) or Dismiss the request. Admin and operations can also decide.",
      ]
        .filter(Boolean)
        .join(" "),
      ctaLabel: "Review request",
      ctaUrl: input.recordUrl,
      stubLabel: "ownership-request",
    });
  } catch (error) {
    console.error("[sendgrid] ownership-request notice failed", error);
  }
}

/** Notify parties after Accept / Dismiss. */
export async function sendOwnershipDecisionEmail(input: {
  toEmail: string;
  toName: string;
  personName: string;
  type: "transfer" | "collaboration";
  accepted: boolean;
  decidedByName: string;
  counterpartName?: string;
  recordUrl: string;
}) {
  const kind = input.type === "transfer" ? "ownership transfer" : "collaboration";
  const outcome = input.accepted ? "accepted" : "dismissed";
  try {
    await deliver({
      to: input.toEmail,
      name: input.toName,
      subject: `${kind} ${outcome} for ${input.personName}`,
      intro: [
        `The ${kind} request for ${input.personName} was ${outcome} by ${input.decidedByName}.`,
        input.accepted && input.type === "transfer" && input.counterpartName
          ? `New owner: ${input.counterpartName}. Prior Communication stays private; submissions and interviews remain on the record.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      ctaLabel: "Open record",
      ctaUrl: input.recordUrl,
      stubLabel: "ownership-decision",
    });
  } catch (error) {
    console.error("[sendgrid] ownership-decision notice failed", error);
  }
}
