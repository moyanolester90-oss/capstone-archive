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

// Characters used for generated temporary passwords, with visually
// ambiguous ones left out (0/O, 1/l/I) since these are read off a screen and
// typed by hand by whoever approved the reset and the person receiving it.
const TEMP_PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const TEMP_PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_SPECIAL = "!@#$%&*?";
const TEMP_PASSWORD_ALL = TEMP_PASSWORD_LOWER + TEMP_PASSWORD_UPPER + TEMP_PASSWORD_DIGITS + TEMP_PASSWORD_SPECIAL;

function randomChar(pool: string): string {
  return pool[randomBytes(1)[0] % pool.length];
}

/**
 * Generates a random temporary password for the admin/adviser-approved
 * "Forgot Password?" flow (`passwordResets.approve` in server/routers.ts).
 * Always satisfies PASSWORD_PATTERN (shared/validation.ts) by construction —
 * at least one lowercase letter, one uppercase letter, one special
 * character, `length` characters total — so it can be saved and signed in
 * with immediately, exactly like a password someone typed themselves.
 */
export function generateTemporaryPassword(length = 12): string {
  const required = [randomChar(TEMP_PASSWORD_LOWER), randomChar(TEMP_PASSWORD_UPPER), randomChar(TEMP_PASSWORD_SPECIAL)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => randomChar(TEMP_PASSWORD_ALL));
  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the three guaranteed characters aren't always in
  // the first three positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
