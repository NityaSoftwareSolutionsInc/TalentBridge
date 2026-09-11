"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  Circle,
  ClipboardList,
  CloudUpload,
  ExternalLink,
  FileSpreadsheet,
  LayoutDashboard,
  ListTodo,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Settings,
  StickyNote,
  UserRound,
} from "lucide-react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  size = 36,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const colors = ["#1d4ed8", "#0f766e", "#7c3aed", "#b45309", "#be123c"];
  const i = name.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0", className)}
      style={{ width: size, height: size, background: colors[i], fontSize: Math.max(11, size * 0.34) }}
    >
      {initials(name || "?")}
    </span>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "blue" | "purple" | "amber" | "red";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    blue: "bg-sky-50 text-sky-800 ring-sky-100",
    purple: "bg-violet-50 text-violet-800 ring-violet-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", map[tone])}>
      {children}
    </span>
  );
}

export const Tag = Badge;

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
    secondary: "bg-white text-slate-700 hover:bg-slate-50 hover:border-blue-300 border-slate-200",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
    danger: "bg-white text-red-700 hover:bg-red-50 border-red-200",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 h-8 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
  badge,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  badge?: string | number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors cursor-pointer",
        "hover:bg-slate-100 hover:text-slate-900",
        active && "bg-blue-50 text-blue-700",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] leading-4 text-white text-center">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function TextLink({
  children,
  onClick,
  href,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const styles = cn(
    "text-[13px] font-medium text-blue-600 underline-offset-2 decoration-blue-600 cursor-pointer",
    "hover:text-blue-800 hover:underline",
    className,
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={styles}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={styles}>
      {children}
    </button>
  );
}

export function FieldInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15",
        className,
      )}
    />
  );
}

export function FieldSelect({
  className,
  wrapClassName,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { wrapClassName?: string }) {
  return (
    <span className={cn("relative inline-flex min-w-0", wrapClassName ?? "w-full")}>
      <select
        {...props}
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-md border border-slate-200 bg-white pl-2.5 pr-7 text-[13px] text-slate-700 outline-none cursor-pointer hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      />
    </span>
  );
}

export function FieldTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15",
        className,
      )}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">{children}</label>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white", className)}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-[13px] font-medium text-slate-700">{title}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 h-8 text-[12px] font-medium text-slate-700 cursor-pointer hover:bg-slate-50 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
    >
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {label}
    </button>
  );
}

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.13 3.25 5.16 4.56.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM12.04 21.8A9.8 9.8 0 0 1 6.92 20.4L3.2 21.5l1.13-3.64A9.86 9.86 0 0 1 2.2 12C2.2 6.59 6.58 2.2 12.03 2.2A9.8 9.8 0 0 1 21.86 12c0 5.42-4.4 9.8-9.82 9.8z" />
    </svg>
  );
}

const ACTION_ICONS: Record<string, LucideIcon | React.ComponentType<{ className?: string }>> = {
  "Send Email": Mail,
  "VioTalk Call": Phone,
  "Log Call": Phone,
  WhatsApp: WhatsAppIcon,
  "Schedule Meeting": CalendarDays,
  "Add Note": StickyNote,
  "Add Follow-up": ListTodo,
  "Add Task": ListTodo,
  "Submit Profile": CloudUpload,
  "Submit Candidate": CloudUpload,
  "Add Requirement": Circle,
  "JNP sync": RefreshCw,
  "Open JobsNProfiles": ExternalLink,
  More: MoreHorizontal,
};

export function IconOnly({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  tone = "slate",
  title,
}: {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "slate" | "blue" | "green";
  title?: string;
}) {
  const tones = {
    slate: "text-slate-600 hover:bg-slate-100",
    blue: "text-[#0A66C2] hover:bg-blue-50",
    green: "bg-emerald-500 text-white hover:bg-emerald-600",
  };
  const className = cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer shrink-0",
    tones[tone],
    disabled && "opacity-40 cursor-not-allowed pointer-events-none",
  );
  const body = <Icon className="h-3.5 w-3.5" />;
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title || label} aria-label={label} className={className}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" title={title || label} aria-label={label} disabled={disabled} onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export function IconChip({
  icon: Icon,
  children,
  onClick,
  href,
  disabled,
  title,
  tone = "slate",
}: {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
  tone?: "slate" | "blue" | "green";
}) {
  const tones = {
    slate: "text-slate-600 hover:bg-slate-100",
    blue: "text-blue-700 hover:bg-blue-50",
    green: "text-emerald-700 hover:bg-emerald-50",
  };
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] cursor-pointer transition-colors",
    tones[tone],
    disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
  );
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} className={className}>
        <Icon className="h-3.5 w-3.5" />
        {children}
      </a>
    );
  }
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={className}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

export function IconBtn({
  label,
  onClick,
  disabled,
  title,
  className,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const Icon = ACTION_ICONS[label] ?? Circle;
  const green = label === "WhatsApp";
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 px-1.5 py-2 cursor-pointer transition-all",
        "hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm active:scale-[0.99]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-slate-50/60 disabled:hover:shadow-none disabled:active:scale-100",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm",
          green ? "bg-emerald-500 group-disabled:bg-slate-300" : "bg-blue-600 group-hover:bg-blue-700 group-disabled:bg-slate-300",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[10px] leading-tight text-center font-medium text-slate-600">{label}</span>
    </button>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  title,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 cursor-pointer hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
      {children}
    </button>
  );
}

export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: "tasks" | "communications";
};

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operations",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Records",
    items: [
      { key: "clients", label: "Client Contacts", icon: Building2 },
      { key: "vendors", label: "Vendor Contacts", icon: ClipboardList },
      { key: "candidates", label: "Candidate Contacts", icon: UserRound },
    ],
  },
  {
    title: "Work",
    items: [
      { key: "calendar", label: "Calendar", icon: CalendarDays },
      { key: "tasks", label: "Tasks", icon: ListTodo, badge: "tasks" },
      { key: "communications", label: "Communications", icon: MessageSquare, badge: "communications" },
    ],
  },
  {
    title: "Commercial",
    items: [
      { key: "msa-po", label: "MSA & PO", icon: FileSpreadsheet },
      { key: "reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [{ key: "settings", label: "Settings", icon: Settings }],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function moduleLabel(moduleKey: string) {
  const map: Record<string, string> = {
    candidates: "Candidate Contacts",
    clients: "Client Contacts",
    vendors: "Vendor Contacts",
    communications: "Communications",
    tasks: "Tasks",
    calendar: "Calendar",
    dashboard: "Today’s Risks",
    reports: "Reports",
    "msa-po": "MSA & PO",
    settings: "Settings",
  };
  return map[moduleKey] ?? moduleKey;
}

export function listTitle(moduleKey: string, count: number) {
  const label = moduleLabel(moduleKey);
  return count ? `${label} (${count})` : label;
}

export function shortDate(v: unknown, compact = false) {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", compact ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

export function kpiLabel(key: string) {
  const map: Record<string, string> = {
    openTasks: "Open tasks",
    openExceptions: "Open exceptions",
    openRequirements: "Open jobs",
    submissionsWaiting: "Awaiting feedback",
  };
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export function tagTone(tag: string): "slate" | "green" | "blue" | "purple" | "amber" | "red" {
  const t = tag.toLowerCase();
  if (t === "active" || t === "approved") return "green";
  if (t === "primary" || t.includes("decision") || t.includes("strategic")) return "purple";
  if (t.includes("engineering") || t.includes("tech") || t.includes("product")) return "blue";
  if (t.includes("high") || t.includes("talent") || t.includes("finance") || t.includes("pending")) return "amber";
  if (t.includes("risk") || t.includes("dnc") || t.includes("expired")) return "red";
  return "slate";
}

export function timeZoneHint(location: unknown) {
  const loc = String(location || "");
  if (!loc) return "";
  if (/san francisco|seattle|ca\b|pst/i.test(loc)) return loc.includes("(") ? loc : `${loc} (PST)`;
  if (/austin|chicago|cst/i.test(loc)) return loc.includes("(") ? loc : `${loc} (CST)`;
  if (/dallas|houston|cdt/i.test(loc)) return loc.includes("(") ? loc : `${loc} (CDT)`;
  return loc;
}

export function availabilityBadge(availability: unknown, status?: unknown): { label: string; tone: "green" | "amber" | "slate" } {
  const a = String(availability || status || "").toLowerCase();
  if (!a) return { label: "Active", tone: "slate" };
  if (a.includes("immediate") || a.includes("available") || a.includes("week")) return { label: "Available", tone: "green" };
  if (a.includes("open") || a.includes("30") || a.includes("opportun")) return { label: "Open to opportunities", tone: "amber" };
  return { label: String(availability || status), tone: "slate" };
}

export function humanize(value: string) {
  return value.replaceAll("_", " ");
}

export const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-blue-600 px-3 h-8 text-[13px] font-medium text-white cursor-pointer hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed";
export const btnGhost =
  "inline-flex items-center justify-center rounded-md px-3 h-8 text-[13px] text-slate-600 cursor-pointer hover:bg-slate-100";
