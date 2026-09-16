export const LOCATION_OPTIONS = [
  "San Francisco",
  "Austin",
  "Seattle",
  "Dallas",
  "Chicago",
  "Remote",
] as const;

export const WORK_AUTH_OPTIONS = [
  "US Citizen",
  "Green Card",
  "H-1B",
  "H-4 EAD",
  "EAD",
  "OPT",
  "CPT",
  "TN",
  "L-1",
  "Need sponsorship",
  "Canadian Citizen",
  "Other",
] as const;

export const EMPLOYMENT_TYPE_OPTIONS = ["W2", "C2C", "1099", "Full-time", "Contract"] as const;

export const RELOCATE_OPTIONS = ["Yes", "No", "Open"] as const;

/** True for empty or JNP placeholder zero rates ($0, $0/hr, 0-0, etc.). */
export function isBlankRate(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—" || raw === "-" || raw === "$ --" || raw === "$--") return true;
  return /^\$?\s*0+(\.0+)?(\s*[-–]\s*\$?\s*0+(\.0+)?)?\s*(\/(hr|mo|yr|hour|month|year))?$/i.test(raw);
}

/** Sanitize synced/stored rate: blank when missing/zero; keep real values. */
export function sanitizeRate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (isBlankRate(raw)) return "";
  return raw;
}

/**
 * Display helper for US/Canada rates — always show a leading $ when there is a value.
 * Does not invent amounts; blank stays blank.
 */
export function formatUsdRateDisplay(value: unknown): string {
  const raw = sanitizeRate(value);
  if (!raw) return "";
  if (raw.startsWith("$")) return raw;
  // Already has a currency symbol (CAD $, etc.) or prose — leave as-is except leading digit.
  if (/^[£€]|CAD|USD/i.test(raw)) return raw;
  if (/^\d/.test(raw)) return `$${raw}`;
  return raw;
}

/** Strip a single leading $ for edit inputs that show a $ prefix. */
export function rateInputValue(value: unknown): string {
  return sanitizeRate(value).replace(/^\$\s*/, "");
}

/** Persist rate with $ when the user typed a bare amount. */
export function normalizeRateInput(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (isBlankRate(raw)) return "";
  if (raw.startsWith("$")) return sanitizeRate(raw);
  if (/^\d/.test(raw)) return sanitizeRate(`$${raw}`);
  return sanitizeRate(raw);
}
