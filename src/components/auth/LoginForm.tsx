"use client";

import type { FormEvent } from "react";
import { useState } from "react";
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const callbackUrl = searchParams.get("callbackUrl") ?? "/";

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Credenciales inválidas. Intenta nuevamente.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-stroke bg-surface-elevated p-8 shadow-soft">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Test Manager
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          Bienvenido
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Inicia sesion para revisar ejecuciones y gestionar pruebas.
        </p>
      </div>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          label="Correo"
          placeholder="qa.lead@product.io"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          label="Contrasena"
          placeholder="********"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" aria-label="Recordarme" />
            Recordarme
          </label>
          <button type="button" className="font-semibold text-brand-700 hover:text-brand-600">
            Olvide mi acceso
          </button>
        </div>
        {error ? (
          <p className="text-xs font-semibold text-danger-500">{error}</p>
        ) : null}
        <Button className="mt-2" disabled={isSubmitting}>
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      <div className="mt-8 rounded-lg border border-stroke bg-brand-50/60 px-5 py-4 text-xs text-ink-muted">
        <p className="font-semibold text-ink">Acceso seguro activo</p>
        <p className="mt-2">
          El inicio de sesion esta integrado con NextAuth para cada organizacion.
        </p>
      </div>
    </div>
  );
}
