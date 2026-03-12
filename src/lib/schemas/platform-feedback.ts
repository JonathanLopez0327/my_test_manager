import { z } from "zod";

const optionalTrimmedString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    });

const emailSchema = z.string().email("Please provide a valid email address.");

export const platformFeedbackSchema = z.object({
  name: optionalTrimmedString(120),
  email: optionalTrimmedString(200).refine(
    (value) => !value || emailSchema.safeParse(value).success,
    {
      message: "Please provide a valid email address.",
    },
  ),
  rating: z.coerce
    .number()
    .int("Please select a valid rating.")
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  message: z
    .string()
    .trim()
    .min(10, "Please share at least 10 characters of feedback.")
    .max(2000),
});

export type PlatformFeedbackFormInput = z.input<typeof platformFeedbackSchema>;
export type PlatformFeedbackInput = z.output<typeof platformFeedbackSchema>;

export type PlatformFeedbackSuccessResponse = {
  ok: true;
  message: string;
};

export type PlatformFeedbackErrorResponse = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type PlatformFeedbackApiResponse =
  | PlatformFeedbackSuccessResponse
  | PlatformFeedbackErrorResponse;
