import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disconnectOutlook } from "@/integrations/microsoftOAuth";
import { audit } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await disconnectOutlook(session.userId, session.tenantId);
  await audit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "disconnect_outlook",
    entityType: "mailbox_map",
    entityId: session.userId,
    after: { connected: false },
  });

  return NextResponse.json({ ok: true });
}
