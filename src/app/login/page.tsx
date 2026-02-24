import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-12">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-100/65 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl" />
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-12 lg:flex-row">
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            QA Command Center
          </p>
          <h2 className="mt-4 text-5xl font-semibold text-ink">
            Visibilidad total para cada run y evidencia de calidad.
          </h2>
          <p className="mt-4 text-base text-ink-muted">
            Centraliza ejecuciones manuales y automatizadas, detecta riesgo antes de release
            y alinea equipos con una operacion QA clara.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Estado de runs en tiempo real",
              "Repositorio de evidencias",
              "Permisos por organizacion",
              "Indicadores de release",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-stroke bg-surface-elevated px-4 py-3 text-xs font-semibold text-ink shadow-soft-xs"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
