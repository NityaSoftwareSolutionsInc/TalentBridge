import { NextResponse } from "next/server";
import { completePasswordSetup } from "@/lib/queries";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const result = await completePasswordSetup(String(body.token || ""), String(body.password || ""));
    return NextResponse.json({ ok: true, email: result.email });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not set password";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
