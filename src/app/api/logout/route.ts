import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/jwt";

function signedOutResponse(req: Request, asRedirect: boolean) {
  const res = asRedirect
    ? NextResponse.redirect(new URL("/login?signedOut=1", req.url))
    : NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

export async function POST(req: Request) {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  return signedOutResponse(req, false);
}

export async function GET(req: Request) {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  return signedOutResponse(req, true);
}
