"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  demoRequestSchema,
  type DemoRequestApiResponse,
  type DemoRequestInput,
} from "@/lib/schemas/demo-request";

type SubmitState = "idle" | "success" | "error";

// Reusable marketing form for demo lead capture.
// Uses the same RHF + Zod conventions used in app forms.
export function DemoRequestForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequestInput>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
    },
  });

  const onSubmit = async (data: DemoRequestInput) => {
    setSubmitState("idle");
    setGlobalMessage(null);

    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as DemoRequestApiResponse;

      if (!response.ok || !payload.ok) {
        if (!payload.ok && payload.fieldErrors) {
          for (const [field, fieldMessages] of Object.entries(payload.fieldErrors)) {
            const firstMessage = fieldMessages?.[0];
            if (!firstMessage) {
              continue;
            }
            setError(field as keyof DemoRequestInput, {
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
      reset();
    } catch {
      setSubmitState("error");
      setGlobalMessage("Something went wrong. Please try again in a minute.");
    }
  };

  return (
    <form
      id="demo-form"
      className="grid gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-describedby="demo-form-feedback"
    >
      <Input
        label="Full name"
        placeholder="Jane Doe"
        autoComplete="name"
        {...register("name")}
        error={errors.name?.message}
      />
      <Input
        label="Work email"
        type="email"
        placeholder="jane@company.com"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <Input
        label="Company"
        placeholder="Acme Inc."
        autoComplete="organization"
        {...register("company")}
        error={errors.company?.message}
      />
      <label className="text-sm font-medium text-ink dark:text-white" htmlFor="message">
        What would you like to improve in your QA process?
      </label>
      <textarea
        id="message"
        rows={5}
        placeholder="Tell us about your testing process, current bottlenecks, and goals."
        className={`w-full rounded-lg border-[1.5px] bg-surface-elevated px-4 py-2.5 text-sm text-ink outline-none transition-all duration-200 ease-[var(--ease-emphasis)] placeholder:text-ink-muted focus:border-brand-500 dark:bg-surface-muted dark:text-white ${errors.message ? "border-danger-500" : "border-stroke"}`}
        {...register("message")}
      />
      {errors.message?.message ? (
        <p className="mt-[-0.5rem] text-xs font-semibold text-danger-600">
          {errors.message.message}
        </p>
      ) : null}

      <div id="demo-form-feedback" aria-live="polite" className="min-h-5">
        {globalMessage ? (
          <p
            className={`text-sm font-medium ${submitState === "success" ? "text-success-500" : "text-danger-600"}`}
          >
            {globalMessage}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="h-12 rounded-xl text-base" disabled={isSubmitting}>
        {isSubmitting ? "Sending request..." : "Request a Demo"}
      </Button>
      <p className="text-xs text-ink-muted">
        Tip: use an email like `name+fail@company.com` to test the error state.
      </p>
    </form>
  );
}
