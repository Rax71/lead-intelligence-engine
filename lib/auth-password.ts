import { scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Só é seguro importar este módulo em código que roda em runtime Node.js
 * (route handlers), nunca no middleware (Edge Runtime não suporta node:crypto).
 */

const SCRYPT_KEYLEN = 64;

export function verifyAdminPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  const separatorIndex = storedHash.indexOf(":");
  if (separatorIndex === -1) return false;

  const saltHex = storedHash.slice(0, separatorIndex);
  const hashHex = storedHash.slice(separatorIndex + 1);

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
    if (actual.length !== expected.length) return false;

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
