export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendGridResult = {
  sent: boolean;
  stub: boolean;
  messageId?: string;
};

function fromAddress() {
  return (process.env.SENDGRID_FROM_EMAIL || "").trim();
}

export function sendgridConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && fromAddress());
}

export async function sendTransactionalEmail(input: TransactionalEmail): Promise<SendGridResult> {
  const key = (process.env.SENDGRID_API_KEY || "").trim();
  const from = fromAddress();
  if (!key || !from) {
    console.info("[sendgrid-stub] invitation/reset email not sent — set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL", {
      to: input.to,
      subject: input.subject,
    });
    return { sent: false, stub: true };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: from, name: "TalentBridge" },
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[sendgrid] send failed", res.status, detail.slice(0, 300));
    throw new Error("Invitation email could not be sent. Check SendGrid configuration.");
  }

  return { sent: true, stub: false, messageId: res.headers.get("x-message-id") || undefined };
}
