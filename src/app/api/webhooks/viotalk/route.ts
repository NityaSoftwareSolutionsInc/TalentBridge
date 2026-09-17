import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestVioTalkWebhook } from "@/lib/queries";

export const runtime = "nodejs";

function verifySignature(rawBody: string, secret: string, header: string | null): boolean {
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * VioTalk → TalentBridge partner webhooks (call.completed, recording/transcript, message.created).
 * Auth: HMAC X-Viotalk-Signature using tenant webhook secret (or VIOTALK_WEBHOOK_HMAC_SECRET).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-viotalk-signature");
  const eventHeader = req.headers.get("x-viotalk-event");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = String(eventHeader || payload.event || "").trim();
  const externalTenantId = String(payload.externalTenantId ?? "").trim();

  if (!event) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  // Resolve tenant: externalTenantId from binding, else single-tenant with secret match.
  let tenantId = externalTenantId;
  let hmacSecret = "";

  if (tenantId) {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    hmacSecret =
      (settings?.viotalkWebhookHmacSecret || process.env.VIOTALK_WEBHOOK_HMAC_SECRET || "").trim();
  } else {
    const envSecret = (process.env.VIOTALK_WEBHOOK_HMAC_SECRET || "").trim();
    if (envSecret) {
      hmacSecret = envSecret;
      const tenants = await prisma.tenant.findMany({
        where: { viotalkAllowed: true, enabled: true },
        select: { id: true },
        take: 2,
      });
      if (tenants.length === 1) tenantId = tenants[0].id;
    }
  }

  if (!tenantId || !hmacSecret) {
    return NextResponse.json({ error: "Unknown tenant or webhook not configured" }, { status: 401 });
  }

  if (!verifySignature(rawBody, hmacSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const result = await ingestVioTalkWebhook(tenantId, event, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[viotalk-webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 500 },
    );
  }
}
