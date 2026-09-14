import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantTicket, replyToTenantTicket } from "@/lib/support-tickets";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const ticket = await getTenantTicket(session, id);
    return NextResponse.json({ ticket, supportMode: Boolean(session.supportMode) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 404 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { body?: string };
    const ticket = await replyToTenantTicket(session, id, String(body.body || ""));
    return NextResponse.json({ ticket });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
