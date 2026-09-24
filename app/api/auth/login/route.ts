import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";
import { verifyAdminPassword } from "@/lib/auth-password";

export const runtime = "nodejs";

type LoginBody = { email?: unknown; password?: unknown };

const GENERIC_ERROR = { error: "Credenciais inválidas" };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;

  // Configuração ausente é tratada como falha de login, nunca como erro revelador.
  if (!adminEmail || !adminPasswordHash || !sessionSecret || !email || !password) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }

  const emailMatches = email.toLowerCase() === adminEmail.toLowerCase();
  const passwordMatches = verifyAdminPassword(password, adminPasswordHash);

  if (!emailMatches || !passwordMatches) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }

  const token = await createSessionToken(sessionSecret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
