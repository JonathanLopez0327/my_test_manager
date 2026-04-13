"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/manager/projects";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Invalid credentials. Please try again.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);

    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("We could not sign in with Google. Please try again.");
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div>
        <h1 className="text-5xl font-semibold text-ink">Sign In</h1>
        <p className="mt-2 text-base text-ink-muted">Enter your email and password to sign in!</p>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || isGoogleSubmitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stroke bg-surface-muted px-4 text-sm font-medium text-ink transition-colors hover:bg-brand-50"
          aria-label="Sign in with Google"
        >
          <Image src="/logos/google.svg" alt="" width={18} height={18} aria-hidden="true" />
          {isGoogleSubmitting ? "Connecting..." : "Sign in with Google"}
        </button>
      </div>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-stroke" />
        <span className="text-sm font-medium text-ink-soft">Or</span>
        <div className="h-px flex-1 bg-stroke" />
      </div>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          label="Email *"
          placeholder="info@gmail.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          label="Password *"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="mt-1 flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-ink">
            <input type="checkbox" className="h-4 w-4 rounded border-stroke accent-brand-600" />
            Keep me logged in
          </label>
          <button type="button" className="font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </button>
        </div>
        {error ? (
          <p className="text-xs font-semibold text-danger-500" aria-live="polite">
            {error}
          </p>
        ) : null}
        <Button className="mt-2 h-12 rounded-xl text-base" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-brand-600 hover:text-brand-700">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
