import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f2ff] via-[#f7f6fb] to-[#efeaff] px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-12 lg:flex-row">
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            QA Command Center
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-ink">
            Keep every run, suite, and artifact visible.
          </h2>
          <p className="mt-4 text-sm text-ink-muted">
            Centralize manual and automated evidence, track execution, and
            align teams around product quality with a calm, focused workflow.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Realtime run status",
              "Evidence vault",
              "Team permissions",
              "Release quality score",
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-white/70 bg-white/70 px-4 py-3 text-xs font-semibold text-ink"
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
