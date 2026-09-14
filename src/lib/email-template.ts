export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[ch] || ch;
  });
}

function brandBaseUrl() {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  return configured || "https://dtalentbridge.d3e.studio";
}

export type TransactionalMailContent = {
  greetingName: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  /** Absolute base URL for logo (defaults to APP_BASE_URL). */
  assetBaseUrl?: string;
};

/**
 * Enterprise-style transactional email (table layout for Outlook/Gmail).
 * Logo uses apple-touch-icon.png hosted on the public app URL.
 */
export function buildTransactionalEmail(input: TransactionalMailContent) {
  const name = input.greetingName.trim() || "there";
  const base = (input.assetBaseUrl || brandBaseUrl()).replace(/\/$/, "");
  const logoUrl = `${base}/apple-touch-icon.png`;

  const textLines = [`Hi ${name},`, "", input.intro, ""];
  if (input.ctaUrl) {
    textLines.push(`${input.ctaLabel || "Open link"}: ${input.ctaUrl}`, "");
  }
  if (input.footer) textLines.push(input.footer, "");
  textLines.push(
    "If you did not expect this email, you can ignore it.",
    "",
    "—",
    "TalentBridge",
    "Relationship and operational hub for staffing teams",
  );

  const ctaHtml = input.ctaUrl
    ? `<tr>
          <td style="padding:0 0 24px 0;">
            <a href="${escapeHtml(input.ctaUrl)}"
               style="display:inline-block;background:#0b1f3a;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:6px;">
              ${escapeHtml(input.ctaLabel || "Open link")}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 24px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#64748b;">
            Or paste this link into your browser:<br/>
            <a href="${escapeHtml(input.ctaUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(input.ctaUrl)}</a>
          </td>
        </tr>`
    : "";

  const footerNote = input.footer
    ? `<tr>
          <td style="padding:0 0 20px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#64748b;">
            ${escapeHtml(input.footer)}
          </td>
        </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>TalentBridge</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid #dbe3ee;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:#0b1f3a;padding:22px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="TalentBridge" style="display:block;border-radius:8px;border:0;"/>
                  </td>
                  <td style="vertical-align:middle;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">
                    TalentBridge
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#0f172a;">
              Hi ${escapeHtml(name)},
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#334155;">
              ${escapeHtml(input.intro)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${ctaHtml}
                ${footerNote}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#94a3b8;">
              If you did not expect this email, you can ignore it.
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:20px 28px 24px 28px;background:#f8fafc;">
              <p style="margin:0 0 4px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#0b1f3a;">
                TalentBridge
              </p>
              <p style="margin:0 0 10px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#64748b;">
                Relationship and operational hub for staffing teams
              </p>
              <p style="margin:0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;color:#94a3b8;">
                This message was sent by TalentBridge. Do not share activation links.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { text: textLines.join("\n"), html };
}
