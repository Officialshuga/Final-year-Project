// ============================================================================
// FILE: src/utils/password.ts
// PURPOSE: Generate strong temporary passwords + validate password strength.
// ----------------------------------------------------------------------------
// NOTE: On the frontend this is only used to DISPLAY a temp password to the
// admin once. The REAL hashing (bcrypt/argon2) happens on the backend; the
// plain temp password is never stored anywhere.
// ============================================================================

const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";   // no I/O/L to avoid confusion
const LOWER = "abcdefghijkmnpqrstuvwxyz";   // no l
const DIGIT = "23456789";                    // no 0/1
const SYMBOL = "!@#$%^&*?-_";

/** Generate a random temporary password (>=10 chars, mixed character types). */
export function generateTempPassword(length = 12): string {
  const all = UPPER + LOWER + DIGIT + SYMBOL;
  // Guarantee at least one of each required type.
  const required = [
    pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL),
  ];
  const remaining = Math.max(length, 10) - required.length;
  const rest = Array.from({ length: remaining }, () => pick(all));
  return shuffle([...required, ...rest]).join("");
}

function pick(set: string): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return set[arr[0] % set.length];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Password strength rules used on the forced "change password" screen. */
export function checkPasswordStrength(pw: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (pw.length < 10) issues.push("At least 10 characters");
  if (!/[A-Z]/.test(pw)) issues.push("One uppercase letter");
  if (!/[a-z]/.test(pw)) issues.push("One lowercase letter");
  if (!/[0-9]/.test(pw)) issues.push("One number");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("One symbol");
  return { ok: issues.length === 0, issues };
}
