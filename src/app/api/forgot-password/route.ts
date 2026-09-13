import { NextResponse } from "next/server";
import { requestForgotPassword } from "@/lib/account-mail";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const origin = req.headers.get("origin");
    const result = await requestForgotPassword(String(body.email || ""), origin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      ok: true,
      message: "If that email is registered, a reset link has been sent.",
    });
  }
}
