import { z } from "zod";

const freeEmailDomainRegex =
  /@(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|icloud\.com|aol\.com)$/i;

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(200)
    .refine((value) => !freeEmailDomainRegex.test(value), {
      message: "Please use your work email.",
    }),
  company: z.string().trim().min(2, "Please add your company name.").max(160),
  message: z
    .string()
    .trim()
    .min(20, "Please share a bit more detail about your needs.")
    .max(2000),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

export type DemoRequestSuccessResponse = {
  ok: true;
  message: string;
};

export type DemoRequestErrorResponse = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type DemoRequestApiResponse =
  | DemoRequestSuccessResponse
  | DemoRequestErrorResponse;
