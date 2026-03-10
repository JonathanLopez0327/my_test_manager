"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeSlug, signUpSchema, type SignUpFormInput } from "@/lib/schemas/sign-up";

type SignUpApiResponse = {
  ok: boolean;
  message: string;
  code?: "VALIDATION_ERROR" | "EMAIL_TAKEN" | "UNKNOWN_ERROR";
  fieldErrors?: Record<string, string[] | undefined>;
};

// Signup form collects user + organization data in one flow.
// The organization slug auto-fills from organization name, but can be edited manually.
export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const callbackUrl = searchParams.get("callbackUrl") || "/manager";

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      organization: {
        name: "",
        slug: "",
      },
    },
  });

  const organizationName = useWatch({
    control,
    name: "organization.name",
    defaultValue: "",
  });
  const suggestedSlug = useMemo(
    () => normalizeSlug(organizationName || ""),
    [organizationName],
  );

  const onSubmit = async (values: SignUpFormInput) => {
    setGlobalError(null);

    const response = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const body = (await response.json()) as SignUpApiResponse;
    if (!response.ok || !body.ok) {
      if (body.fieldErrors) {
        const knownFields: Path<SignUpFormInput>[] = [
          "firstName",
          "lastName",
          "email",
          "password",
          "organization.name",
          "organization.slug",
        ];

        for (const field of knownFields) {
          const issue = body.fieldErrors[field];
          if (issue?.[0]) {
            setError(field, { message: issue[0] });
          }
        }

        const orgIssue = body.fieldErrors.organization?.[0];
        if (orgIssue && !body.fieldErrors["organization.name"]?.[0]) {
          setError("organization.name", { message: orgIssue });
        }
      }

      setGlobalError(body.message || "We could not create your account.");
      return;
    }

    const signInResult = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
      callbackUrl,
    });

    if (signInResult?.error) {
      setGlobalError("Your account was created, but we could not sign you in automatically.");
      router.push("/login");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  const handleGoogleSignUp = async () => {
    setGlobalError(null);
    setIsGoogleSubmitting(true);

    try {
      await signIn("google", { callbackUrl });
    } catch {
      setGlobalError("We could not continue with Google. Please try again.");
      setIsGoogleSubmitting(false);
    }
  };

  const slugError = errors.organization?.slug?.message;
  const orgNameError = errors.organization?.name?.message;

  return (
    <div className="w-full max-w-md">
      <div>
        <h1 className="text-5xl font-semibold text-ink">Create Account</h1>
        <p className="mt-2 text-base text-ink-muted">
          Set up your user and organization in one step.
        </p>
      </div>
      <div className="mt-8">
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isSubmitting || isGoogleSubmitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stroke bg-surface-muted px-4 text-sm font-medium text-ink transition-colors hover:bg-brand-50"
          aria-label="Continue with Google"
        >
          <span aria-hidden="true">G</span>
          {isGoogleSubmitting ? "Connecting..." : "Continue with Google"}
        </button>
      </div>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-stroke" />
        <span className="text-sm font-medium text-ink-soft">Or</span>
        <div className="h-px flex-1 bg-stroke" />
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h2 className="text-sm font-semibold text-ink">User information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name *"
            autoComplete="given-name"
            placeholder="Jane"
            error={errors.firstName?.message}
            aria-invalid={errors.firstName ? "true" : "false"}
            {...register("firstName")}
          />
          <Input
            label="Last name *"
            autoComplete="family-name"
            placeholder="Doe"
            error={errors.lastName?.message}
            aria-invalid={errors.lastName ? "true" : "false"}
            {...register("lastName")}
          />
        </div>
        <Input
          type="email"
          label="Email *"
          autoComplete="email"
          placeholder="team@company.com"
          error={errors.email?.message}
          aria-invalid={errors.email ? "true" : "false"}
          {...register("email")}
        />
        <Input
          type="password"
          label="Password *"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          aria-invalid={errors.password ? "true" : "false"}
          {...register("password")}
        />

        <div className="my-2 flex items-center gap-4">
          <div className="h-px flex-1 bg-stroke" />
          <span className="text-sm font-medium text-ink-soft">Organization</span>
          <div className="h-px flex-1 bg-stroke" />
        </div>

        <Input
          label="Organization name *"
          autoComplete="organization"
          placeholder="Acme QA"
          error={orgNameError}
          aria-invalid={orgNameError ? "true" : "false"}
          {...register("organization.name", {
            onChange: (event) => {
              const currentName = event.target.value as string;
              if (!slugEditedManually) {
                setValue("organization.slug", normalizeSlug(currentName), {
                  shouldValidate: true,
                });
              }
            },
          })}
        />
        <Input
          label="Organization slug (optional)"
          placeholder="acme-qa"
          error={slugError}
          hint={!slugEditedManually && suggestedSlug ? `Suggested: ${suggestedSlug}` : undefined}
          aria-invalid={slugError ? "true" : "false"}
          {...register("organization.slug", {
            onChange: (event) => {
              const nextSlug = normalizeSlug(String(event.target.value || ""));
              setSlugEditedManually(nextSlug.length > 0);
              setValue("organization.slug", nextSlug, { shouldValidate: true });
            },
          })}
        />

        {globalError ? (
          <p className="rounded-lg bg-danger-500/10 px-4 py-2 text-sm text-danger-500" aria-live="polite">
            {globalError}
          </p>
        ) : null}

        <Button type="submit" className="h-12 rounded-xl text-base" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
