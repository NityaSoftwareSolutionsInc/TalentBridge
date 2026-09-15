import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken, clearSessionCookie } from "@/lib/jwt";
import { resolvePublicOrigin } from "@/lib/public-origin";

const PUBLIC_PATHS = [
  "/login",
  "/set-password",
  "/api/login",
  "/api/users",
  "/api/logout",
  "/api/password",
  "/api/forgot-password",
  "/api/support-session",
];

const PUBLIC_ASSETS = new Set([
  "/icon.svg",
  "/icon-32.png",
  "/apple-touch-icon.png",
  "/opengraph-image",
  "/twitter-image",
  "/favicon.ico",
  "/favicon-v2.ico",
]);

function isPublic(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (PUBLIC_ASSETS.has(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySessionToken(token) : null;

  if (!claims) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const origin = resolvePublicOrigin(req);
    const res = NextResponse.redirect(new URL("/login", origin));
    if (token) clearSessionCookie(res);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
