/**
 * Validation rules shared by the upload form (browser) and the API (server),
 * so both sides always agree on what is allowed.
 */

/** Largest document a student may attach to a project. */
export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Allowed document types, checked by file extension (browsers report ZIP types inconsistently). */
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".zip"] as const;

export const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function isAllowedUploadFile(fileName: string): boolean {
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(getFileExtension(fileName));
}

/** Size in bytes of the data encoded in a base64 string. */
export function base64DecodedSize(base64: string): number {
  const clean = base64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** School year must look like "2024-2025", with the second year right after the first. */
export function isValidSchoolYear(value: string): boolean {
  const match = /^(\d{4})-(\d{4})$/.exec(value.trim());
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}

export const SCHOOL_YEAR_MESSAGE =
  "School Year must be in the format YYYY-YYYY with consecutive years (e.g., 2024-2025)";

/**
 * True if a string contains emoji or pictographic symbols
 * (both the supplementary emoji planes and common BMP symbol blocks).
 */
export function containsEmojis(str: string): boolean {
  const BMP_SYMBOL_RANGES: Array<[number, number]> = [
    [0x2600, 0x26ff], // Misc Symbols
    [0x2700, 0x27bf], // Dingbats
    [0xfe00, 0xfe0f], // Variation Selectors (emoji presentation)
    [0x2500, 0x257f], // Box Drawing
    [0x25a0, 0x25ff], // Geometric Shapes
    [0x2400, 0x24ff], // Control Pictures
    [0x2800, 0x28ff], // Braille
    [0x3000, 0x303f], // CJK Symbols and Punctuation
  ];
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0x1f000) return true;
    for (const [start, end] of BMP_SYMBOL_RANGES) {
      if (cp >= start && cp <= end) return true;
    }
  }
  return false;
}

export const EMOJI_TITLE_MESSAGE = "Project title must not contain emojis";

/**
 * Credential sign-up/sign-in rules, shared by the Sign Up form (browser) and
 * the API (server) so both sides agree on what's a valid School ID/password.
 */
export const SCHOOL_ID_PATTERN = /^[0-9]{3,30}$/;
export const SCHOOL_ID_MESSAGE = "School ID must contain numbers only (3-30 digits)";

export const PASSWORD_MIN_LENGTH = 8;
/** At least one uppercase letter, one lowercase letter, one special character, and the minimum length. */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, and a special character`;

export const SCHOOL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SCHOOL_EMAIL_MESSAGE = "Enter a valid school email (e.g. lib@guv.edu.ph)";

/** Letters and spaces only (no numbers or special characters), so it also rejects a blank/whitespace-only name. */
export const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
export const NAME_MESSAGE = "Name must contain letters and spaces only";

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const YEAR_SECTION_MESSAGE = "Please select your year level and enter your section";
