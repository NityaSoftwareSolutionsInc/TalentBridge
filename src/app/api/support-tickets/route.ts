import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createTenantTicket, listTenantTickets } from "@/lib/support-tickets";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tickets = await listTenantTickets(session);
  return NextResponse.json({ tickets, supportMode: Boolean(session.supportMode) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      subject?: string;
      body?: string;
      category?: string;
      priority?: string;
    };
    const ticket = await createTenantTicket(session, body);
    return NextResponse.json({ ticket });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
