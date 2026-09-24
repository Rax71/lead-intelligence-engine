import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/auth/logout", "/api/health"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let authenticated = false;
  if (sessionSecret && token) {
    authenticated = await verifySessionToken(token, sessionSecret);
  }

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
