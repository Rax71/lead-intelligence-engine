/**
 * Sessão administrativa (SIGNAL 360).
 *
 * Usa apenas Web Crypto API (crypto.subtle, btoa/atob, TextEncoder/TextDecoder),
 * disponível tanto no runtime Node das route handlers quanto no Edge Runtime do
 * middleware do Next.js 14.2.15. Não usa node:crypto nem Buffer aqui de propósito,
 * para que este arquivo possa ser importado pelo middleware sem quebrar o bundle Edge.
 */

export const SESSION_COOKIE_NAME = "s360_admin_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

type SessionPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const base64 = normalized + "=".repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(secret: string): Promise<string> {
  const now = Date.now();
  const payload: SessionPayload = { sub: "admin", iat: now, exp: now + SESSION_TTL_MS };
  const payloadB64Url = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64Url));
  const signatureB64Url = toBase64Url(new Uint8Array(signature));

  return `${payloadB64Url}.${signatureB64Url}`;
}

/**
 * crypto.subtle.verify faz a comparação de assinatura internamente de forma
 * resistente a timing attacks, então nenhuma comparação manual é necessária aqui.
 */
export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64Url, signatureB64Url] = parts;

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = fromBase64Url(signatureB64Url);
  } catch {
    return false;
  }

  const key = await importHmacKey(secret);
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(payloadB64Url)
  );
  if (!validSignature) return false;

  try {
    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64Url));
    const payload = JSON.parse(payloadJson) as Partial<SessionPayload>;
    if (typeof payload.exp !== "number") return false;
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
