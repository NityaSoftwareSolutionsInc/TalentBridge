/** Shared brand mark / OG card for Next.js ImageResponse (edge-safe inline styles). */

export function BrandMark({ size }: { size: number }) {
  const unit = size / 48;
  const r = 12.5 * unit;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 18 * unit - r,
          top: 17.5 * unit - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: "#38bdf8",
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 30 * unit - r,
          top: 17.5 * unit - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: "#2563eb",
          opacity: 0.94,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 24 * unit - r,
          top: 29.5 * unit - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: "#94a3b8",
          opacity: 0.9,
        }}
      />
    </div>
  );
}

export function BrandOgCard({
  product,
  title,
  subtitle,
  badge,
}: {
  product: string;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(165deg, #071526 0%, #0b1f3a 48%, #0f2a4a 100%)",
        color: "#f8fafc",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BrandMark size={52} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              TalentBridge
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(186, 230, 253, 0.85)",
              }}
            >
              {product}
            </div>
          </div>
        </div>
        {badge ? (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(15,23,42,0.45)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#cbd5e1",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 650,
            letterSpacing: "-0.03em",
            lineHeight: 1.12,
            color: "#ffffff",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 24,
            lineHeight: 1.45,
            color: "#94a3b8",
            maxWidth: 820,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 28,
          fontSize: 16,
          color: "#64748b",
        }}
      >
        <span>Secure tenant workspace</span>
        <span style={{ color: "#334155" }}>·</span>
        <span>Role-based access</span>
        <span style={{ color: "#334155" }}>·</span>
        <span>Audit-ready activity</span>
      </div>
    </div>
  );
}
