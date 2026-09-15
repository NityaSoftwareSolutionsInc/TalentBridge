export const MAX_EMAIL_SIGNATURE_CHARS = 20000;

const HTML_TAG_RE =
  /<(?:table|tbody|thead|tfoot|tr|td|th|div|span|p|br|img|a|font|b|strong|i|em|hr|u)\b/i;

export function looksLikeHtml(value: string): boolean {
  return HTML_TAG_RE.test(String(value || ""));
}

/** Strip scripted markup so Outlook HTML tables/images still send, but scripts do not. */
export function sanitizeSignatureHtml(html: string): string {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function plainTextToHtml(text: string): string {
  const escaped = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div>${escaped.replace(/\n/g, "<br/>")}</div>`;
}

export function composeEmailHtml(plainMessage: string, signature = ""): string {
  const sig = String(signature || "").trim();
  if (!sig) return plainTextToHtml(plainMessage);
  if (looksLikeHtml(sig)) {
    return `${plainTextToHtml(plainMessage)}<div style="margin-top:16px;"></div>${sanitizeSignatureHtml(sig)}`;
  }
  return plainTextToHtml(`${plainMessage}\n\n--\n${sig}`);
}
