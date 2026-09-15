import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  buildConnectUrl,
  microsoftOAuthConfigured,
  oauthStateCookieName,
} from "@/integrations/microsoftOAuth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.outlookAllowed) {
    return NextResponse.json({ error: "Outlook is not enabled for this tenant" }, { status: 403 });
  }
  if (!microsoftOAuthConfigured()) {
    return NextResponse.json(
      { error: "Microsoft OAuth is not configured on the server (CLIENT_ID / CLIENT_SECRET)." },
      { status: 503 },
    );
  }

  const map = await prisma.mailboxMap.findFirst({
    where: { userId: session.userId, tenantId: session.tenantId },
  });
  const assigned = String(map?.mailbox || "").trim();
  if (!assigned) {
    return NextResponse.json(
      {
        error:
          "An administrator must assign your Outlook mailbox in Settings (Mailbox map) before you can Connect Outlook.",
      },
      { status: 400 },
    );
  }

  const origin = new URL(req.url).origin;
  try {
    const { url, state } = await buildConnectUrl({
      userId: session.userId,
      tenantId: session.tenantId,
      origin,
      loginHint: assigned,
    });
    const res = NextResponse.redirect(url);
    res.cookies.set(oauthStateCookieName(), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https"),
      path: "/",
      maxAge: 60 * 15,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start Outlook connect" }, { status: 500 });
  }
}
