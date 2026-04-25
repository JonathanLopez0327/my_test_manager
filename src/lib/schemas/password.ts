// Centralized password policy. Used by signup, profile updates, and admin
// user creation/edits so requirements stay consistent. Tunable in one place
// when the policy evolves.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyError =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_MISSING_LOWERCASE"
  | "PASSWORD_MISSING_UPPERCASE"
  | "PASSWORD_MISSING_DIGIT"
  | "PASSWORD_MISSING_SYMBOL";

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; code: PasswordPolicyError; message: string };

const SYMBOL_RE = /[^A-Za-z0-9]/;

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      code: "PASSWORD_TOO_LONG",
      message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      ok: false,
      code: "PASSWORD_MISSING_LOWERCASE",
      message: "Password must contain a lowercase letter.",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      ok: false,
      code: "PASSWORD_MISSING_UPPERCASE",
      message: "Password must contain an uppercase letter.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      ok: false,
      code: "PASSWORD_MISSING_DIGIT",
      message: "Password must contain a digit.",
    };
  }
  if (!SYMBOL_RE.test(password)) {
    return {
      ok: false,
      code: "PASSWORD_MISSING_SYMBOL",
      message: "Password must contain a symbol.",
    };
  }
  return { ok: true };
}
