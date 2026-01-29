import { z } from "zod";

export const projectSchema = z.object({
    key: z
        .string()
        .min(2, "El key debe tener al menos 2 caracteres")
        .max(10, "El key no puede exceder los 10 caracteres")
        .regex(/^[A-Z0-9_-]+$/, "El key solo puede contener mayúsculas, números y guiones")
        .transform((val) => val.toUpperCase()),
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    description: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
// Input type for forms where some fields might be optional/undefined initially
export type ProjectFormInput = z.input<typeof projectSchema>;
