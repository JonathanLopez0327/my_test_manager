"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  platformFeedbackSchema,
  type PlatformFeedbackApiResponse,
  type PlatformFeedbackFormInput,
  type PlatformFeedbackInput,
} from "@/lib/schemas/platform-feedback";

type SubmitState = "idle" | "success" | "error";

// Reusable landing feedback form with RHF + Zod.
// Uses the same submit/error conventions as other public forms.
export function PlatformFeedbackForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlatformFeedbackFormInput, unknown, PlatformFeedbackInput>({
    resolver: zodResolver(platformFeedbackSchema),
    defaultValues: {
      name: "",
      email: "",
      rating: 5,
      message: "",
    },
  });

  const onSubmit = async (data: PlatformFeedbackInput) => {
    setSubmitState("idle");
    setGlobalMessage(null);

    try {
      const response = await fetch("/api/platform-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as PlatformFeedbackApiResponse;

      if (!response.ok || !payload.ok) {
        if (!payload.ok && payload.fieldErrors) {
          for (const [field, fieldMessages] of Object.entries(payload.fieldErrors)) {
            const firstMessage = fieldMessages?.[0];
            if (!firstMessage) {
              continue;
            }
            setError(field as keyof PlatformFeedbackFormInput, {
              type: "server",
              message: firstMessage,
            });
          }
        }

        setSubmitState("error");
        setGlobalMessage(payload.message);
        return;
      }

      setSubmitState("success");
      setGlobalMessage(payload.message);
      reset({
        name: "",
        email: "",
        rating: 5,
        message: "",
      });
    } catch {
      setSubmitState("error");
      setGlobalMessage("Something went wrong. Please try again in a minute.");
    }
  };

  return (
    <form
      id="platform-feedback-form"
      className="grid gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-describedby="platform-feedback-form-feedback"
    >
      <Input
        label="Name (optional)"
        placeholder="Jane Doe"
        autoComplete="name"
        {...register("name")}
        error={errors.name?.message}
      />
      <Input
        label="Email (optional)"
        type="email"
        placeholder="jane@company.com"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />

      <div className="w-full">
        <label
          htmlFor="feedback-rating"
          className="mb-1.5 block text-sm font-medium text-ink dark:text-white"
        >
          Rating
        </label>
        <select
          id="feedback-rating"
          className={`h-10 w-full rounded-lg border-[1.5px] bg-surface-elevated px-4 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] focus:border-brand-500 dark:bg-surface-muted dark:text-white ${errors.rating ? "border-danger-500" : "border-stroke"}`}
          aria-invalid={errors.rating ? "true" : "false"}
          {...register("rating", { valueAsNumber: true })}
        >
          <option value={5}>5 - Excellent</option>
          <option value={4}>4 - Good</option>
          <option value={3}>3 - Average</option>
          <option value={2}>2 - Needs work</option>
          <option value={1}>1 - Poor</option>
        </select>
        {errors.rating?.message ? (
          <p className="mt-1 text-xs font-semibold text-danger-600">{errors.rating.message}</p>
        ) : null}
      </div>

      <label className="text-sm font-medium text-ink dark:text-white" htmlFor="feedback-message">
        Your feedback
      </label>
      <textarea
        id="feedback-message"
        rows={5}
        placeholder="Tell us what is working well and what we should improve."
        className={`w-full rounded-lg border-[1.5px] bg-surface-elevated px-4 py-2.5 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] placeholder:text-ink-muted focus:border-brand-500 dark:bg-surface-muted dark:text-white ${errors.message ? "border-danger-500" : "border-stroke"}`}
        aria-invalid={errors.message ? "true" : "false"}
        {...register("message")}
      />
      {errors.message?.message ? (
        <p className="mt-[-0.5rem] text-xs font-semibold text-danger-600">{errors.message.message}</p>
      ) : null}

      <div id="platform-feedback-form-feedback" aria-live="polite" className="min-h-5">
        {globalMessage ? (
          <p
            className={`text-sm font-medium ${submitState === "success" ? "text-success-500" : "text-danger-600"}`}
          >
            {globalMessage}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="h-12 rounded-xl text-base" disabled={isSubmitting}>
        {isSubmitting ? "Sending feedback..." : "Send feedback"}
      </Button>
    </form>
  );
}
