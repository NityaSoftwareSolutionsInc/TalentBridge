/** Match helpers — display values stay on Person.email / Person.phone. */

export function normalizeEmail(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** Digits only; keeps leading country code digits when present. */
export function normalizePhone(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

export function outreachChannelBlocks(person: {
  doNotReach?: boolean;
  doNotEmail?: boolean;
  doNotSms?: boolean;
}) {
  const master = Boolean(person.doNotReach);
  return {
    call: master,
    email: master || Boolean(person.doNotEmail),
    sms: master || Boolean(person.doNotSms),
  };
}
