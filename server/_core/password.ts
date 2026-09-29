import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;

/**
 * Hashes a password with scrypt (built into Node, no extra dependency to
 * install). Stored as `salt:hash`, both hex-encoded.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/** Verifies a password against a hash produced by hashPassword(). */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  try {
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    const storedKey = Buffer.from(hashHex, "hex");
    if (storedKey.length !== derivedKey.length) return false;
    return timingSafeEqual(derivedKey, storedKey);
  } catch {
    return false;
  }
}
