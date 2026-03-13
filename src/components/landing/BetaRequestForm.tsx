"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type State = "idle" | "submitting" | "success" | "error";

export function BetaRequestForm() {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/beta-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setState("success");
        setEmail("");
      } else {
        const payload = (await res.json()) as { message?: string };
        setState("error");
        setErrorMessage(payload.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  if (state === "success") {
    return (
      <p className="text-sm font-medium text-success-500">
        Check your inbox — your code is on its way.
      </p>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <Input
        label="Your email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <div aria-live="polite" className="min-h-5">
        {errorMessage ? (
          <p className="text-sm font-medium text-danger-600">{errorMessage}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="h-12 rounded-xl text-base"
        disabled={state === "submitting"}
      >
        {state === "submitting" ? "Sending..." : "Request access"}
      </Button>
    </form>
  );
}
