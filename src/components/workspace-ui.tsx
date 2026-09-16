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
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { looksLikeHtml, sanitizeSignatureHtml } from "@/lib/email-signature-html";

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
  size = 32,
  className = "",
  src,
}: {
  name: string;
  size?: number;
  className?: string;
  /** Optional image (e.g. company logo). Falls back to initials. */
  src?: string | null;
}) {
  const colors = ["#1d4ed8", "#0f766e", "#334155", "#b45309", "#be123c"];
  const i = name.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("inline-block shrink-0 rounded-md object-cover border border-slate-200 bg-white", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0", className)}
      style={{ width: size, height: size, background: colors[i], fontSize: Math.max(11, size * 0.34) }}
      aria-hidden
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
    purple: "bg-slate-100 text-slate-800 ring-slate-200",
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

const controlFocus =
  "outline-none focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className,
  title,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
  /** When set, renders as a link (for external actions like Open JobsNProfiles). */
  href?: string;
}) {
  const styles = {
    primary:
      "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-transparent shadow-[var(--shadow-sm)]",
    secondary:
      "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] border-[var(--color-border)]",
    ghost: "bg-transparent text-[var(--color-text-secondary)] hover:bg-slate-100 border-transparent",
    danger:
      "bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] border-[var(--color-danger-border)]",
  };
  const classNames = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 h-8 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
    styles[variant],
    className,
  );
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={classNames}>
        {children}
      </a>
    );
  }
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={classNames}
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
        "relative inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors cursor-pointer",
        "hover:bg-slate-100 hover:text-[var(--color-text)]",
        active && "bg-blue-50 text-[var(--color-accent)]",
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
    "text-[13px] font-medium text-[var(--color-accent)] underline-offset-2 cursor-pointer",
    "hover:text-[var(--color-accent-hover)] hover:underline",
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

export function FieldInput({
  className,
  label,
  error,
  required,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  required?: boolean;
}) {
  const inputId = id || props.name;
  return (
    <div className="min-w-0">
      {label ? (
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
      ) : null}
      <input
        {...props}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
          controlFocus,
          error && "border-[var(--color-danger)]",
          className,
        )}
      />
      {error ? <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

export function FieldSelect({
  className,
  wrapClassName,
  children,
  label,
  error,
  required,
  id,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapClassName?: string;
  label?: string;
  error?: string;
  required?: boolean;
}) {
  const selectId = id || props.name;
  return (
    <div className={cn("min-w-0", wrapClassName)}>
      {label ? (
        <Label htmlFor={selectId} required={required}>
          {label}
        </Label>
      ) : null}
      <span className="relative inline-flex min-w-0 w-full">
        <select
          {...props}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-8 w-full min-w-0 appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-7 text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-border-strong)]",
            controlFocus,
            error && "border-[var(--color-danger)]",
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
      </span>
      {error ? <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

export function FieldTextarea({
  className,
  label,
  error,
  required,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  required?: boolean;
}) {
  const areaId = id || props.name;
  return (
    <div className="min-w-0">
      {label ? (
        <Label htmlFor={areaId} required={required}>
          {label}
        </Label>
      ) : null}
      <textarea
        {...props}
        id={areaId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-[13px] text-[var(--color-text)]",
          controlFocus,
          error && "border-[var(--color-danger)]",
          className,
        )}
      />
      {error ? <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

export function Label({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
      {children}
      {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
    </label>
  );
}

export function SignaturePreview({ body, className }: { body: string; className?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(180);
  const trimmed = String(body || "").trim();
  if (!trimmed) return null;
  if (!looksLikeHtml(trimmed)) {
    return (
      <pre className={cn("whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-800", className)}>
        {trimmed}
      </pre>
    );
  }
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_blank"/><style>
html,body{margin:0;padding:0;background:#fff;overflow:hidden;}
body{padding:12px 14px;}
img{max-width:100%;height:auto;}
a{color:inherit;}
table{max-width:100%;}
</style></head><body>${sanitizeSignatureHtml(trimmed)}</body></html>`;
  return (
    <iframe
      key={trimmed}
      ref={frameRef}
      title="How this signature looks in Outlook"
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      onLoad={() => {
        const doc = frameRef.current?.contentDocument;
        const next = Math.max(
          doc?.body?.scrollHeight || 0,
          doc?.documentElement?.scrollHeight || 0,
        );
        if (next) setHeight(Math.min(Math.max(next + 4, 120), 900));
      }}
      className={cn("block w-full bg-white", className)}
      style={{ height, border: 0, overflow: "hidden", pointerEvents: "none" }}
    />
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
      <h3 className="tb-section-title">{title}</h3>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-[13px] font-medium text-[var(--color-text-secondary)]">{title}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">{hint}</div> : null}
      {action ? <div className="mt-3 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tb-skeleton h-8 w-full" />
      ))}
    </div>
  );
}

export function InlineError({
  title,
  reason,
  onRetry,
  secondaryAction,
}: {
  title: string;
  reason?: string;
  onRetry?: () => void;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px]"
    >
      <div className="font-semibold text-[var(--color-danger)]">{title}</div>
      {reason ? <p className="mt-1 text-[var(--color-text-secondary)]">{reason}</p> : null}
      {(onRetry || secondaryAction) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {onRetry ? (
            <Button variant="danger" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const map = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-[var(--color-success-bg)] text-[var(--color-success)]",
    warning: "border-amber-200 bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
    danger: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  };
  return (
    <div role="status" className={cn("rounded-[var(--radius-md)] border px-3 py-2 text-[13px]", map[tone], className)}>
      {children}
    </div>
  );
}

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 max-w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] pl-2 pr-1 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
      <span className="truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove filter ${label}`}
          onClick={onRemove}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-slate-200"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  getLabel,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  getLabel?: (item: string) => string;
}) {
  return (
    <nav aria-label="Sections">
      <div
        role="tablist"
        className="flex gap-0.5 overflow-x-auto border-b border-[var(--color-border)] px-2 [scrollbar-width:thin]"
      >
        {items.map((item) => {
          const active = item === value;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item)}
              className={cn(
                "shrink-0 px-2.5 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                active
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {getLabel ? getLabel(item) : item}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PageHeader({
  title,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  meta,
}: {
  title: string;
  breadcrumbs?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="min-w-0">
        {breadcrumbs ? <div className="tb-meta mb-0.5">{breadcrumbs}</div> : null}
        <h1 className="tb-page-title truncate">{title}</h1>
        {meta ? <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{meta}</div> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {secondaryActions}
        {primaryAction}
      </div>
    </div>
  );
}

export function DataTable({
  columns,
  children,
  className,
}: {
  columns: { key: string; label: string; className?: string }[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-auto border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)]", className)}>
      <table className="min-w-full text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] border-b border-[var(--color-border)]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn("px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]", col.className)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  widthClass = "w-full max-w-md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close drawer" className="absolute inset-0 bg-slate-900/30 cursor-default" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("relative z-10 h-full bg-[var(--color-surface)] shadow-[var(--shadow-md)] border-l border-[var(--color-border)] flex flex-col", widthClass)}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="tb-section-title">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
        {footer ? <div className="border-t border-[var(--color-border)] px-4 py-3 flex justify-end gap-2">{footer}</div> : null}
      </aside>
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
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 h-8 text-[12px] font-medium text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
    >
      <Icon className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
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
  Email: Mail,
  Call: Phone,
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
    "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-[12px] cursor-pointer transition-colors",
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
  compact = false,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Icon only — label shown on hover via title / aria-label */
  compact?: boolean;
}) {
  const Icon = ACTION_ICONS[label] ?? Circle;
  const green = label === "WhatsApp";
  const tip = title?.trim() ? title : label;
  return (
    <button
      type="button"
      title={tip}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] cursor-pointer transition-colors",
        compact ? "h-10 w-10 shrink-0" : "w-full min-h-[52px] flex-col gap-1 px-1.5 py-1.5",
        "hover:border-[var(--color-accent)] hover:bg-blue-50",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)] disabled:hover:bg-[var(--color-surface-muted)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full text-white",
          compact ? "h-7 w-7" : "h-6 w-6",
          green ? "bg-emerald-500 group-disabled:bg-slate-300" : "bg-[var(--color-accent)] group-disabled:bg-slate-300",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      {!compact ? (
        <span className="text-[10px] leading-tight text-center font-medium text-[var(--color-text-secondary)]">{label}</span>
      ) : null}
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
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {Icon ? <Icon className="h-4 w-4 text-[var(--color-text-muted)]" /> : null}
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
      { key: "clients", label: "Clients", icon: Building2 },
      { key: "vendors", label: "Vendors", icon: ClipboardList },
      { key: "candidates", label: "Candidates", icon: UserRound },
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
    candidates: "Candidates",
    clients: "Clients",
    vendors: "Vendors",
    communications: "Communications",
    tasks: "Tasks",
    calendar: "Calendar",
    dashboard: "Dashboard",
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
    ownershipPending: "Ownership requests",
  };
  return map[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export function tagTone(tag: string): "slate" | "green" | "blue" | "purple" | "amber" | "red" {
  const t = tag.toLowerCase();
  if (t === "active" || t === "approved") return "green";
  if (t === "primary" || t.includes("decision") || t.includes("strategic")) return "purple";
  if (t.includes("engineering") || t.includes("tech") || t.includes("product")) return "blue";
  if (t.includes("high") || t.includes("talent") || t.includes("finance") || t.includes("pending")) return "amber";
  if (t.includes("risk") || t.includes("dnc") || t.includes("reach") || t.includes("expired")) return "red";
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

/** @deprecated Prefer Button variant="primary" */
export const btnPrimary =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 h-8 text-[13px] font-medium text-white cursor-pointer hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed";
/** @deprecated Prefer Button variant="ghost" */
export const btnGhost =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] px-3 h-8 text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:bg-slate-100";
