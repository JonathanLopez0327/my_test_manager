import { z } from "zod";

const PASSWORD_MIN_LENGTH = 8;
const ORG_SLUG_MAX_LENGTH = 50;
const ORG_SLUG_MIN_LENGTH = 3;
const orgSlugRegex = /^[a-z0-9-]+$/;

export function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export const signUpSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required.").max(80),
  lastName: z.string().trim().min(2, "Last name is required.").max(80),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ),
  organization: z.object({
    name: z.string().trim().min(2, "Organization name is required.").max(120),
    slug: z
      .string()
      .trim()
      .max(ORG_SLUG_MAX_LENGTH)
      .optional()
      .transform((value) => {
        if (!value) return undefined;
        const normalized = normalizeSlug(value);
        return normalized.length > 0 ? normalized : undefined;
      })
      .refine(
        (value) =>
          value === undefined ||
          (value.length >= ORG_SLUG_MIN_LENGTH && orgSlugRegex.test(value)),
        {
          message:
            "Slug must contain 3-50 lowercase letters, numbers, or hyphens.",
        },
      ),
  }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpFormInput = z.input<typeof signUpSchema>;
