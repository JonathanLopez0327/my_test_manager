import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoRequestForm } from "./DemoRequestForm";

const features = [
  {
    title: "Faster release confidence",
    description:
      "Plan, execute, and report all QA activity in one place so every release decision is backed by real evidence.",
  },
  {
    title: "Traceability across the lifecycle",
    description:
      "Connect projects, plans, suites, cases, and runs without context switching between disconnected tools.",
  },
  {
    title: "Operational clarity for teams",
    description:
      "Give QA, dev, and leadership the same source of truth with live metrics and consistent run outcomes.",
  },
];

const modules = [
  "Project & environment structure",
  "Test plans and suite hierarchies",
  "Reusable manual and automated test cases",
  "Run execution with pass/fail/skipped tracking",
  "Artifacts with screenshot and log evidence",
  "Actionable dashboard and trend metrics",
];

const metrics = [
  { value: "35%", label: "Faster test-cycle planning" },
  { value: "42%", label: "Lower rework from missed regressions" },
  { value: "3x", label: "More visibility for stakeholders" },
];

const faqs = [
  {
    question: "Is Test Manager suitable for both manual and automated QA?",
    answer:
      "Yes. You can manage manual run execution and track automation status inside the same model, without splitting workflows.",
  },
  {
    question: "Can we attach evidence for failed runs?",
    answer:
      "Yes. Runs can include screenshot and log artifacts so incidents are easier to diagnose and audit later.",
  },
  {
    question: "How quickly can a team get started?",
    answer:
      "Most teams can configure projects, plans, and first runs in a short onboarding cycle with minimal process changes.",
  },
];

// Marketing landing layout for Test Manager.
// Keeps content sections reusable and only delegates interactivity to the demo form.
export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas text-ink">
      <div
        className="pointer-events-none absolute inset-x-0 top-[-18rem] h-[36rem] bg-[radial-gradient(ellipse_at_top,_rgba(90,168,255,0.22),_transparent_58%),radial-gradient(ellipse_at_30%_20%,_rgba(109,89,255,0.18),_transparent_60%)]"
        aria-hidden="true"
      />

      <header className="relative z-10 border-b border-stroke/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Test Manager home" className="block">
            <BrandLogo variant="full" className="h-9 w-auto" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-stroke bg-surface-elevated px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand-50"
            >
              Log in
            </Link>
            <a
              href="#demo-form"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft-xs transition-colors hover:bg-brand-700"
            >
              Request a Demo
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-16 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
          <div className="space-y-6">
            <Badge tone="info" className="w-fit">
              QA Operations Platform
            </Badge>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Manage test quality with one system your whole team can trust.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Test Manager helps QA teams centralize test planning, execution, evidence,
              and reporting so releases move faster with less risk.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a href="#demo-form">
                <Button size="lg" className="rounded-xl px-7">
                  Request a Demo
                </Button>
              </a>
              <Link
                href="/manager"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stroke bg-surface-elevated px-6 text-sm font-semibold text-ink transition-colors hover:bg-brand-50"
              >
                Explore Product
              </Link>
            </div>
          </div>

          <Card className="rounded-2xl border-stroke-strong/80 p-6 sm:p-7" elevation="raised">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Request a demo</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Tell us about your QA goals and we&apos;ll show you a tailored workflow.
            </p>
            <div className="mt-6">
              <DemoRequestForm />
            </div>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-14">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((item) => (
              <Card key={item.title} className="rounded-xl p-5" elevation="flat">
                <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{item.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-14">
          <Card className="rounded-2xl p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink">
                  Product modules built for complete test operations
                </h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Designed for QA teams that need structured execution and measurable outcomes.
                </p>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {modules.map((module) => (
                <li
                  key={module}
                  className="rounded-lg border border-stroke bg-surface px-4 py-3 text-sm font-medium text-ink"
                >
                  {module}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-14">
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((item) => (
              <Card key={item.label} className="rounded-xl p-6 text-center">
                <p className="text-3xl font-semibold text-brand-700">{item.value}</p>
                <p className="mt-2 text-sm text-ink-muted">{item.label}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-14">
          <Card className="rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Frequently asked questions</h2>
            <div className="mt-6 space-y-4">
              {faqs.map((item) => (
                <article key={item.question} className="rounded-xl border border-stroke bg-surface p-4">
                  <h3 className="text-sm font-semibold text-ink sm:text-base">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{item.answer}</p>
                </article>
              ))}
            </div>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <Card className="rounded-2xl border-brand-300 bg-brand-50/60 p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Ready to upgrade your QA workflow?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-muted sm:text-base">
              Centralize planning, execution, and quality metrics in a single platform made for
              modern product teams.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href="#demo-form">
                <Button size="lg" className="rounded-xl px-7">
                  Request a Demo
                </Button>
              </a>
              <Link
                href="/manager"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stroke bg-surface px-6 text-sm font-semibold text-ink transition-colors hover:bg-brand-100/50"
              >
                Open dashboard
              </Link>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-stroke/80 bg-canvas/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-sm text-ink-muted">
          <p>© {new Date().getFullYear()} Test Manager. All rights reserved.</p>
          <p>Built for software quality teams.</p>
        </div>
      </footer>
    </div>
  );
}
