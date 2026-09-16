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

/** Rate period for bill/pay (staffing + FTE). */
export const RATE_PERIOD_OPTIONS = [
  { value: "hr", label: "Hourly", suffix: "/hr" },
  { value: "day", label: "Daily", suffix: "/day" },
  { value: "yr", label: "Yearly", suffix: "/yr" },
] as const;

export type RatePeriod = (typeof RATE_PERIOD_OPTIONS)[number]["value"];

/** True for empty or JNP placeholder zero rates ($0, $0/hr, 0-0, etc.). */
export function isBlankRate(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—" || raw === "-" || raw === "$ --" || raw === "$--") return true;
  return /^\$?\s*0+(\.0+)?(\s*[-–]\s*\$?\s*0+(\.0+)?)?\s*(\/(hr|mo|yr|day|hour|month|year|daily))?$/i.test(raw);
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

/** Strip leading $ and period suffix for amount-only edit inputs. */
export function rateInputValue(value: unknown): string {
  const raw = sanitizeRate(value).replace(/^\$\s*/, "");
  return raw.replace(/\s*\/\s*(hr|hour|hours|day|daily|mo|month|yr|year|annually)\s*$/i, "").trim();
}

/** Detect stored period from a rate string (default hourly for bare amounts). */
export function parseRatePeriod(value: unknown, fallback: RatePeriod = "hr"): RatePeriod {
  const raw = String(value ?? "").toLowerCase();
  if (/\/\s*(yr|year|annually)\b/.test(raw) || /\bper\s*year\b/.test(raw)) return "yr";
  if (/\/\s*(day|daily)\b/.test(raw) || /\bper\s*day\b/.test(raw)) return "day";
  if (/\/\s*(mo|month)\b/.test(raw) || /\bper\s*month\b/.test(raw)) return "hr"; // treat month as hourly UI default for POC
  if (/\/\s*(hr|hour|hours)\b/.test(raw) || /\bper\s*hour\b/.test(raw)) return "hr";
  return fallback;
}

export function ratePeriodSuffix(period: RatePeriod): string {
  return RATE_PERIOD_OPTIONS.find((o) => o.value === period)?.suffix || "/hr";
}

/** Persist rate with $ and optional period suffix (e.g. $95/hr, $145000/yr). */
export function normalizeRateInput(value: unknown, period?: RatePeriod): string {
  const raw = String(value ?? "").trim();
  if (isBlankRate(raw)) return "";
  const amount = rateInputValue(raw);
  if (!amount || isBlankRate(amount)) return "";
  const withDollar = amount.startsWith("$") ? amount : /^\d/.test(amount) ? `$${amount}` : amount;
  const bare = withDollar.replace(/\s*\/\s*(hr|hour|hours|day|daily|mo|month|yr|year|annually)\s*$/i, "").trim();
  if (period !== undefined) {
    return `${bare}${ratePeriodSuffix(period)}`;
  }
  // Preserve a period that was already on the value; otherwise store bare $amount.
  if (/\/\s*(hr|hour|hours|day|daily|mo|month|yr|year|annually)\b/i.test(raw)) {
    return `${bare}${ratePeriodSuffix(parseRatePeriod(raw, "hr"))}`;
  }
  return bare;
}
