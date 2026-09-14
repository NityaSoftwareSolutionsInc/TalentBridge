const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Common consumer / free mailbox providers — not allowed for TalentBridge accounts. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "ymail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.in",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "tutanota.com",
  "tuta.io",
  "zoho.com",
  "zohomail.com",
  "rediffmail.com",
  "inbox.com",
  "fastmail.com",
  "hey.com",
  "qq.com",
  "163.com",
  "126.com",
]);

export function normalizeEmail(raw: string) {
  return String(raw || "").trim().toLowerCase();
}

export function isBusinessEmail(raw: string) {
  const email = normalizeEmail(raw);
  if (!EMAIL_RE.test(email)) return false;
  const domain = email.split("@")[1] || "";
  return Boolean(domain) && !FREE_MAIL_DOMAINS.has(domain);
}

/** Throws a user-facing error when the address is missing, invalid, or a free provider. */
export function assertBusinessEmail(raw: string) {
  const email = normalizeEmail(raw);
  if (!email) throw new Error("Email is required");
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address");
  const domain = email.split("@")[1] || "";
  if (FREE_MAIL_DOMAINS.has(domain)) {
    throw new Error(
      "Use a business email address. Personal providers (Gmail, Yahoo, Outlook.com, etc.) are not allowed.",
    );
  }
  return email;
}
