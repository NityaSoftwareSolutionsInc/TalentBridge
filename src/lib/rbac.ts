import { TbRole } from "@prisma/client";

export const ALL_PERMISSIONS = [
  "read",
  "candidates",
  "clients",
  "vendors",
  "msa",
  "po",
  "reports",
  "admin",
  "recording",
  "export",
  "ownership_transfer",
  "change_stage",
  "submit",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<TbRole, Permission[]> = {
  recruiter: ["read", "candidates", "submit"],
  sales: ["read", "clients", "vendors", "msa", "po", "change_stage", "ownership_transfer"],
  operations: [
    "read",
    "candidates",
    "clients",
    "vendors",
    "msa",
    "po",
    "reports",
    "change_stage",
    "ownership_transfer",
  ],
  leadership: ["read", "candidates", "clients", "vendors", "msa", "reports"],
  admin: [...ALL_PERMISSIONS],
};

export const ROLE_LANDING: Record<TbRole, string> = {
  recruiter: "candidates",
  sales: "clients",
  operations: "dashboard",
  leadership: "dashboard",
  admin: "settings",
};

export function hasPermission(role: TbRole, extra: string[], permission: Permission) {
  const set = new Set([...ROLE_PERMISSIONS[role], ...extra]);
  return set.has(permission);
}

export function canSeePoAmounts(role: TbRole, extra: string[]) {
  return hasPermission(role, extra, "po");
}

export function canPlayRecording(role: TbRole, extra: string[], playbackAllowed: boolean) {
  return playbackAllowed && hasPermission(role, extra, "recording");
}
