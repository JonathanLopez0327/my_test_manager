import { z } from "zod";

export const organizationCreateSchema = z.object({
  slug: z
    .string()
    .min(3, "El slug debe tener al menos 3 caracteres")
    .max(50, "El slug no puede exceder los 50 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "El slug solo puede contener minúsculas, números y guiones",
    )
    .transform((val) => val.toLowerCase()),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
});

export type OrganizationCreateFormValues = z.infer<typeof organizationCreateSchema>;
export type OrganizationCreateFormInput = z.input<typeof organizationCreateSchema>;

export const organizationUpdateSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").optional(),
  slug: z
    .string()
    .min(3, "El slug debe tener al menos 3 caracteres")
    .max(50, "El slug no puede exceder los 50 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "El slug solo puede contener minúsculas, números y guiones",
    )
    .transform((val) => val.toLowerCase())
    .optional(),
  isActive: z.boolean().optional(),
});

export type OrganizationUpdateFormValues = z.infer<typeof organizationUpdateSchema>;
export type OrganizationUpdateFormInput = z.input<typeof organizationUpdateSchema>;
