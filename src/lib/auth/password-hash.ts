import { hash } from "bcryptjs";

// Centralized bcrypt cost. OWASP 2025 recommends ≥12; pick higher only after
// measuring login latency, since bcryptjs is JS (not native) and ~3-5x slower
// than the native binding. Bumped from 10 to 12 — every legacy hash will
// transparently keep working until the user changes their password.
export const PASSWORD_HASH_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, PASSWORD_HASH_COST);
}
