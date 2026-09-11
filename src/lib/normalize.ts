/** Match helpers — display values stay on Contact.email / Contact.phone. */

export function normalizeEmail(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** Digits only; keeps leading country code digits when present. */
export function normalizePhone(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

export function contactChannelBlocks(contact: {
  doNotContact?: boolean;
  doNotEmail?: boolean;
  doNotSms?: boolean;
}) {
  const master = Boolean(contact.doNotContact);
  return {
    call: master,
    email: master || Boolean(contact.doNotEmail),
    sms: master || Boolean(contact.doNotSms),
  };
}
