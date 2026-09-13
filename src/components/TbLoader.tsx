"use client";

import { useId } from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Primary mark — three overlapping nodes (people / systems / outcomes). */
export function TalentBridgeMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const a = `tb-mark-a-${uid}`;
  const b = `tb-mark-b-${uid}`;
  const c = `tb-mark-c-${uid}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={a} x1="8" y1="6" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id={b} x1="20" y1="6" x2="40" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={c} x1="14" y1="20" x2="34" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="17.5" r="12.5" fill={`url(#${a})`} fillOpacity="0.95" />
      <circle cx="30" cy="17.5" r="12.5" fill={`url(#${b})`} fillOpacity="0.94" />
      <circle cx="24" cy="29.5" r="12.5" fill={`url(#${c})`} fillOpacity="0.9" />
    </svg>
  );
}

/** Full lockup for auth and branded surfaces. */
export function TalentBridgeLogo({
  size = 40,
  theme = "light",
  product = "Contact Manager",
  className,
}: {
  size?: number;
  theme?: "light" | "dark";
  product?: string | null;
  className?: string;
}) {
  const dark = theme === "dark";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-[10px] ring-1",
          dark ? "bg-white/8 ring-white/15" : "bg-slate-50 ring-slate-200/80",
        )}
        style={{ width: size + 10, height: size + 10 }}
      >
        <TalentBridgeMark size={size} />
      </span>
      <div className="min-w-0 leading-tight">
        <div
          className={cn(
            "font-[family-name:var(--font-auth-display)] text-[1.35rem] tracking-[-0.02em]",
            dark ? "text-white" : "text-slate-950",
          )}
        >
          TalentBridge
        </div>
        {product ? (
          <div
            className={cn(
              "mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em]",
              dark ? "text-sky-200/80" : "text-slate-500",
            )}
          >
            {product}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TbLoaderMark({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const wrap = size + 28;
  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: wrap, height: wrap }}
    >
      <span className="tb-loader-ring tb-spin-rev absolute inset-0 rounded-full" />
      <span
        className="absolute rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
        style={{ width: size + 16, height: size + 16 }}
      />
      <span className="tb-spin relative grid place-items-center" style={{ width: size, height: size }}>
        <TalentBridgeMark size={size} />
      </span>
    </div>
  );
}

type TbLoaderProps = {
  label?: string;
  hint?: string;
  variant?: "overlay" | "page" | "inline";
  className?: string;
};

export function TbLoader({
  label = "TalentBridge",
  hint = "Please wait",
  variant = "overlay",
  className,
}: TbLoaderProps) {
  const copy = (
    <>
      <TbLoaderMark size={variant === "inline" ? 40 : 56} />
      <div className={cn("text-center", variant === "inline" ? "mt-3" : "mt-4")}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          {label}
        </div>
        <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">{hint}</div>
      </div>
    </>
  );

  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={hint}
        className={cn("flex flex-col items-center justify-center py-10", className)}
      >
        {copy}
      </div>
    );
  }

  const shell = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={hint}
      className={cn(
        "tb-loader-overlay flex items-center justify-center cursor-wait",
        variant === "page" ? "min-h-screen bg-[var(--color-sidebar)]" : "fixed inset-0 z-[80]",
        className,
      )}
    >
      {variant === "overlay" ? <div className="absolute inset-0 bg-[var(--color-sidebar)]/45" /> : null}
      <div className="tb-loader-card relative w-[220px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-7 shadow-[var(--shadow-md)]">
        <div className="flex flex-col items-center">{copy}</div>
      </div>
    </div>
  );

  return shell;
}
