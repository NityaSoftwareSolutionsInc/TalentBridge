"use client";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function TalentBridgeMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="18" cy="17.5" r="12.5" fill="#38bdf8" fillOpacity="0.92" />
      <circle cx="30" cy="17.5" r="12.5" fill="#2563eb" fillOpacity="0.92" />
      <circle cx="24" cy="29.5" r="12.5" fill="#94a3b8" fillOpacity="0.88" />
    </svg>
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
