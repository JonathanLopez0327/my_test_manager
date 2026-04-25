import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { PlatformFeedbackForm } from "@/components/landing/PlatformFeedbackForm";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#agents", label: "Agents" },
  { href: "/docs", label: "Docs" },
  { href: "#feedback", label: "Feedback" },
  { href: "#demo", label: "Demo" },
];

const featureCards = [
  {
    title: "Structured test planning",
    description:
      "Move from release ideas to executable plans with project-aware suites, reusable cases, and clear ownership.",
    icon: GridIcon,
  },
  {
    title: "Evidence-first execution",
    description:
      "Capture pass, fail, skipped, screenshots, logs, and context in one run record instead of scattered chats and spreadsheets.",
    icon: EvidenceIcon,
  },
  {
    title: "Project AI workspace",
    description:
      "Use project-scoped AI conversations with persistent context to accelerate test design and QA decision-making.",
    icon: PulseIcon,
  },
  {
    title: "AI agents in the loop",
    description:
      "Authenticated agents read run state, draft test cases, and triage failures with the same RBAC your team uses.",
    icon: AgentIcon,
  },
];

const workflowChecks = [
  "Release planning",
  "Suite organization",
  "Ownership mapping",
  "Execution tracking",
  "Quality visibility",
  "AI workspace",
];

const proofStats = [
  { value: "Traceability", label: "Plans, cases, runs, and bugs in one place" },
  { value: "Execution", label: "Record results, failures, and evidence across your test cycles." },
  { value: "AI Workspace", label: "Project-scoped AI for QA workflows" },
];

const agentSteps = [
  {
    step: "01",
    title: "Authenticate as a workspace agent",
    description:
      "Each agent is provisioned a scoped token tied to your organization and project, governed by the same RBAC your team uses.",
  },
  {
    step: "02",
    title: "Run inside your test context",
    description:
      "Agents read plans, suites, runs, and bug data so suggestions land in your structure — not a generic chat.",
  },
  {
    step: "03",
    title: "Stream results back to the team",
    description:
      "Drafted cases, triaged failures, and summaries flow back into the project record with full traceability.",
  },
];

const agentChatTurns = [
  {
    role: "user",
    name: "Team",
    text: "Summarize what failed in run #1284 and propose retries.",
  },
  {
    role: "agent",
    name: "QA Agent",
    text: "3 failures across Checkout — 2 likely flaky (retry once), 1 regression in /pay/intent. Draft retry plan?",
  },
  {
    role: "user",
    name: "Team",
    text: "Yes, and open a bug for the regression.",
  },
];

const operatingModes = [
  {
    name: "Manual QA",
    summary: "Guide exploratory and scripted test execution with consistent status tracking.",
    points: ["Step-by-step runs", "Fast defect triage", "Evidence attached per result"],
  },
  {
    name: "AI workspace",
    summary: "Use project-scoped AI to support test design and QA workflows within the same product context.",
    points: ["Persistent project context", "Faster test design support", "Shared QA workflow assistance"],
  },
  {
    name: "Release visibility",
    summary: "Turn noisy updates into a clean readiness signal for go/no-go decisions.",
    points: ["Run-level metrics", "Open risk visibility", "Readiness reporting"],
  },
];

// Marketing landing adapted from the imported startup template.
// Keeps the template-style section flow while reusing current product branding and demo capture.
export function LandingPage() {
  return (
    <div className="relative overflow-x-clip bg-canvas text-ink">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(90,168,255,0.16),_transparent_28%),radial-gradient(circle_at_15%_22%,_rgba(109,89,255,0.16),_transparent_34%),radial-gradient(circle_at_85%_18%,_rgba(109,89,255,0.10),_transparent_26%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-40 border-b border-stroke/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/" aria-label="Test Manager home" className="shrink-0">
            <BrandLogo variant="full" className="h-11 w-auto" priority />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-muted md:flex">
            {navItems.map((item) => {
              const isInternal = item.href.startsWith("/");
              const className =
                "group relative transition-colors hover:text-ink";
              const inner = (
                <>
                  {item.label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-brand-500 transition-all duration-300 group-hover:w-full" />
                </>
              );
              return isInternal ? (
                <Link key={item.href} href={item.href} className={className}>
                  {inner}
                </Link>
              ) : (
                <a key={item.href} href={item.href} className={className}>
                  {inner}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/login"
              className="hidden rounded-lg border border-stroke bg-surface-elevated px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 sm:inline-flex"
            >
              Log in
            </Link>
            <a href="#demo">
              <Button className="rounded-xl px-5">Get started</Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pb-16 pt-20 md:pb-24 md:pt-28 xl:pb-28 xl:pt-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative mx-auto max-w-4xl text-center">
              <Badge tone="info" className="mx-auto mb-6 w-fit">
                QA Operations Platform
              </Badge>
              <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl lg:text-6xl">
                Centralize your entire QA workflow in one platform.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-ink-muted sm:text-lg">
                Manage test plans, suites, cases, runs, bugs, and evidence with full traceability—plus an AI workspace built for faster test design and decision-making.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
                <a href="#demo">
                  <Button size="lg" className="w-full rounded-xl px-8 sm:w-auto">
                    Get started
                  </Button>
                </a>
                <Link
                  href="/docs"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-stroke bg-surface-elevated px-6 text-base font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:shadow-[0_8px_24px_-12px_rgba(109,89,255,0.35)]"
                >
                  Read the docs
                  <ArrowRightIcon />
                </Link>
              </div>

              <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
                {proofStats.slice(0, 3).map((stat) => (
                  <div
                    key={stat.label}
                    className="group relative overflow-hidden rounded-2xl border border-stroke bg-white/70 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_18px_40px_-24px_rgba(109,89,255,0.45)] dark:bg-surface-muted/80"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    />
                    <div className="text-2xl font-semibold tracking-tight text-brand-700">{stat.value}</div>
                    <div className="mt-2 text-sm leading-6 text-ink-muted">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute right-0 top-0 hidden opacity-70 lg:block"
            aria-hidden="true"
          >
            <HeroOrb />
          </div>
          <div
            className="pointer-events-none absolute bottom-0 left-0 hidden opacity-60 lg:block"
            aria-hidden="true"
          >
            <HeroLines />
          </div>
        </section>

        <section id="features" className="py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge tone="neutral" className="mx-auto w-fit">
                Core capabilities
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Everything your QA workflow needs in one platform
              </h2>
              <p className="mt-4 text-base leading-7 text-ink-muted">
                From structured planning to execution evidence and AI-assisted collaboration, MTM helps teams keep quality work organized and visible.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((feature) => (
                <Card
                  key={feature.title}
                  className="group relative overflow-hidden rounded-[1.75rem] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_24px_60px_-32px_rgba(109,89,255,0.45)]"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-3deg] dark:from-brand-500/15 dark:to-brand-500/5">
                    <feature.icon />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-ink-muted">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <Badge tone="info" className="w-fit">
                  Workflow coverage
                </Badge>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Built for QA teams that need structure without losing speed
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted">
                  Plan releases, organize coverage, assign owners, and execute test work in a workflow that keeps status, evidence, and quality decisions visible.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {workflowChecks.map((item) => (
                    <div
                      key={item}
                      className="group flex items-start gap-3 rounded-2xl border border-stroke bg-surface-elevated px-4 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 transition-transform duration-300 group-hover:scale-110 dark:from-brand-500/15 dark:to-brand-500/5">
                        <CheckIcon />
                      </span>
                      <p className="text-sm leading-6 text-ink">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-x-10 top-4 h-40 rounded-full bg-brand-500/12 blur-3xl" />
                <Card className="relative rounded-[2rem] p-6">
                  <div className="grid gap-4">
                    <div className="rounded-[1.5rem] border border-stroke bg-surface p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-ink-muted">Plan</p>
                          <p className="text-lg font-semibold text-ink">Release 24.8 regression</p>
                        </div>
                        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                          42 cases
                        </span>
                      </div>
                      <div className="mt-5 grid gap-3">
                        <StageCard title="Suite hierarchy" text="Checkout, Billing, Mobile smoke, API sanity" />
                        <StageCard title="Assignments" text="Owners mapped by platform and release lane" />
                        <StageCard title="Execution goals" text="Critical path coverage before release approval" />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {operatingModes.map((mode) => (
                        <div
                          key={mode.name}
                          className="rounded-[1.5rem] border border-stroke bg-surface px-4 py-5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_28px_-20px_rgba(109,89,255,0.4)]"
                        >
                          <p className="text-sm font-semibold text-ink">{mode.name}</p>
                          <p className="mt-2 text-xs leading-6 text-ink-muted">{mode.summary}</p>
                          <ul className="mt-4 space-y-2 text-xs text-ink">
                            {mode.points.map((point) => (
                              <li key={point} className="flex items-start gap-2">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="agents" className="relative py-16 md:py-20 lg:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-72 max-w-5xl bg-[radial-gradient(ellipse_at_center,_rgba(109,89,255,0.18),_transparent_60%)]"
          />
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge tone="info" className="mx-auto w-fit">
                AI agents
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Agents that work alongside your QA team
              </h2>
              <p className="mt-4 text-base leading-7 text-ink-muted">
                Bring authenticated agents into your test workflow. They live inside your project context, follow the same permissions, and leave a trace of every action — no glue code, no shadow tools.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              <ol className="space-y-4">
                {agentSteps.map((item) => (
                  <li
                    key={item.step}
                    className="group relative rounded-[1.5rem] border border-stroke bg-surface-elevated p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_18px_42px_-26px_rgba(109,89,255,0.5)]"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-sm font-semibold tracking-tight text-brand-700 dark:from-brand-500/15 dark:to-brand-500/5">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-base font-semibold text-ink">{item.title}</p>
                        <p className="mt-1.5 text-sm leading-6 text-ink-muted">{item.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
                <div className="pt-2">
                  <Link
                    href="/docs"
                    className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                  >
                    Learn how to wire an agent
                    <ArrowRightIcon />
                  </Link>
                </div>
              </ol>

              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[linear-gradient(135deg,rgba(109,89,255,0.18),rgba(90,168,255,0.16),transparent_70%)] blur-2xl" />
                <Card className="rounded-[2rem] border-stroke-strong/70 p-5 sm:p-6">
                  <div className="flex items-center justify-between border-b border-stroke pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 dark:from-brand-500/15 dark:to-brand-500/5">
                        <AgentIcon />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">Run #1284</p>
                        <p className="text-xs text-ink-muted">Checkout regression suite</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-success-500/30 bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-500/10">
                      live
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {agentChatTurns.map((turn, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col gap-1 ${turn.role === "agent" ? "items-start" : "items-end"}`}
                      >
                        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                          {turn.name}
                        </span>
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            turn.role === "agent"
                              ? "rounded-tl-sm border border-stroke bg-surface-elevated text-ink"
                              : "rounded-tr-sm bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-[0_10px_24px_-12px_rgba(109,89,255,0.6)]"
                          }`}
                        >
                          {turn.text}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1 text-xs text-ink-muted">
                      <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                      Agent is drafting retry plan…
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/*
        <section id="proof" className="py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="rounded-[2rem] border border-stroke bg-[linear-gradient(135deg,rgba(109,89,255,0.08),rgba(90,168,255,0.06),rgba(255,255,255,0.66))] p-8 dark:bg-[linear-gradient(135deg,rgba(109,89,255,0.14),rgba(90,168,255,0.10),rgba(19,26,45,0.95))] sm:p-10">
              <div className="max-w-2xl">
                <Badge tone="info" className="w-fit">
                  Outcomes
                </Badge>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  One quality workspace, clearer release decisions
                </h2>
                <p className="mt-4 text-base leading-8 text-ink-muted">
                  Rather than promise abstract growth metrics, the adapted landing speaks directly
                  to the operational gains QA teams care about: coordination speed, auditability, and confidence.
                </p>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {proofStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1.5rem] border border-white/45 bg-white/80 p-5 shadow-soft-xs dark:border-white/10 dark:bg-surface-muted/90"
                  >
                    <p className="text-3xl font-semibold text-brand-700">{stat.value}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        */}

        {/*
        <section className="py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge tone="neutral" className="mx-auto w-fit">
                Team feedback
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                What teams actually gain when quality work stops living in spreadsheets
              </h2>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {testimonials.map((item) => (
                <Card key={item.role} className="rounded-[1.75rem] p-6">
                  <p className="text-base leading-8 text-ink">&ldquo;{item.quote}&rdquo;</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      {item.role
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.role}</p>
                      <p className="text-xs text-ink-muted">Test Manager evaluation team</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
        */}

        {/*
        <section className="py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <Card className="rounded-[2rem] p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
                <div>
                  <Badge tone="info" className="w-fit">
                    Common questions
                  </Badge>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
                    Frequently asked questions
                  </h2>
                  <p className="mt-4 text-base leading-8 text-ink-muted">
                    The imported template includes a late-page trust section. Here it becomes a
                    concise FAQ for buyers evaluating a QA operations platform.
                  </p>
                </div>

                <div className="space-y-4">
                  {faqs.map((item) => (
                    <article
                      key={item.question}
                      className="rounded-[1.5rem] border border-stroke bg-surface px-5 py-5"
                    >
                      <h3 className="text-base font-semibold text-ink">{item.question}</h3>
                      <p className="mt-3 text-sm leading-7 text-ink-muted">{item.answer}</p>
                    </article>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>
        */}

        <section id="feedback" className="py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div>
                <Badge tone="info" className="w-fit">
                  Product feedback
                </Badge>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Help us improve the platform
                </h2>
                <p className="mt-4 text-base leading-8 text-ink-muted">
                  Share your experience with Test Manager and tell us what would make your QA workflow better.
                </p>
                <div className="mt-8 space-y-3 text-sm text-ink-muted">
                  <p>- Highlight what is working well for your team</p>
                  <p>- Point out friction in planning or execution workflows</p>
                  <p>- Suggest improvements for future releases</p>
                </div>
              </div>

              <Card className="rounded-[2rem] border-stroke-strong/90 p-6 sm:p-8">
                <Badge tone="neutral" className="w-fit">
                  We read every response
                </Badge>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Leave your feedback
                </h3>
                <p className="mt-3 text-sm leading-7 text-ink-muted">
                  Your input helps us prioritize the features that matter most.
                </p>
                <div className="mt-8">
                  <PlatformFeedbackForm />
                </div>
              </Card>
            </div>
          </div>
        </section>
        <section id="demo" className="pb-20 pt-16 md:pb-24 md:pt-20 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] bg-[linear-gradient(145deg,#121d66_0%,#101755_52%,#151d73_100%)] p-8 text-white shadow-[0_28px_80px_-40px_rgba(16,23,85,0.9)] sm:p-10">
                <Badge tone="neutral" className="border-white/15 bg-white/10 text-white">
                  Book a walkthrough
                </Badge>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  See how MTM brings structure to your QA workflow
                </h2>
                <p className="mt-4 text-base leading-8 text-white/78">
                  Share your current process and we’ll show how planning, execution, evidence, and release visibility can work in one shared system.
                </p>

                <div className="mt-8 space-y-4 text-sm text-white/86">
                  <DemoBullet text="Review your current QA workflow and bottlenecks" />
                  <DemoBullet text="See how plans, runs, defects, and evidence stay connected" />
                  <DemoBullet text="Identify the fastest path to an initial rollout" />
                </div>
              </div>

              <Card className="rounded-[2rem] border-stroke-strong/90 p-6 sm:p-8">
                <Badge tone="neutral" className="w-fit">
                  Start now
                </Badge>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Get started with Test Manager
                </h3>
                <p className="mt-3 text-sm leading-7 text-ink-muted">
                  Set up your workspace and start organizing test plans, cases, runs, evidence, and QA visibility in one place.
                </p>
                <div className="mt-8 space-y-3 text-sm text-ink-muted">
                  <p>- Create your team workspace</p>
                  <p>- Organize plans, cases, runs, and bugs</p>
                  <p>- Start building a more structured QA workflow</p>
                  <p>- Start integrating AI in your process</p>
                </div>
                <div className="mt-8">
                  <Link href="/sign-up">
                    <Button className="h-12 w-full rounded-xl text-base">Get started</Button>
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stroke/80 bg-canvas/90">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo variant="full" className="h-9 w-auto" />
            <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">
              Built for software teams that need test operations, evidence, and release clarity in
              one place.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { href: "#features", label: "Features" },
              { href: "#workflow", label: "Workflow" },
              { href: "#agents", label: "Agents" },
              { href: "#demo", label: "Get started" },
            ]}
          />
          <FooterColumn
            title="Resources"
            links={[
              { href: "/docs", label: "Documentation" },
              { href: "/docs#agents", label: "Agent guide" },
              { href: "/docs#api", label: "API reference" },
              { href: "#feedback", label: "Feedback" },
            ]}
          />
          <FooterColumn
            title="Account"
            links={[
              { href: "/login", label: "Log in" },
              { href: "/sign-up", label: "Sign up" },
            ]}
          />
        </div>
        <div className="border-t border-stroke/80">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Test Manager. All rights reserved.</p>
            <p>QA operations platform for modern software teams.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
        {links.map((link) => {
          const isInternal = link.href.startsWith("/");
          const className = "transition-colors hover:text-ink";
          return (
            <li key={link.href}>
              {isInternal ? (
                <Link href={link.href} className={className}>
                  {link.label}
                </Link>
              ) : (
                <a href={link.href} className={className}>
                  {link.label}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StageCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="group rounded-2xl border border-stroke bg-surface-elevated p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 text-xs leading-6 text-ink-muted">{text}</p>
    </div>
  );
}

function DemoBullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
        <CheckIcon className="text-white" />
      </span>
      <p>{text}</p>
    </div>
  );
}

function CheckIcon({ className = "text-brand-700" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 13"
      fill="currentColor"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
    >
      <path d="M5.853 12.663a.5.5 0 0 1-.707 0L.68 8.195a.5.5 0 0 1 0-.707L2.33 5.837a.5.5 0 0 1 .707 0l2.109 2.116a.5.5 0 0 0 .708 0L13.38.421a.5.5 0 0 1 .707 0l1.651 1.65a.5.5 0 0 1 0 .708L5.853 12.663Z" />
    </svg>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M12 3.75v2M5.5 5.5l1.4 1.4M18.5 5.5l-1.4 1.4M5 12.25h2M17 12.25h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="6.5"
        y="7.25"
        width="11"
        height="10.5"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="10" cy="12.25" r="1.1" fill="currentColor" />
      <circle cx="14" cy="12.25" r="1.1" fill="currentColor" />
      <path
        d="M10 15.5h4M9.25 20.25h5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 4.5h7M16.5 14v7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M7 3.75h7.5L20 9.25v9A1.75 1.75 0 0 1 18.25 20H7a3 3 0 0 1-3-3V6.75A3 3 0 0 1 7 3.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.75v4.5A1.75 1.75 0 0 0 15.75 10H20M8 13.5h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M3.75 12h4.1l1.95-4.9 4.4 9.8 1.95-4.9h4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.75 6.75A3 3 0 0 1 6.75 3.75h10.5a3 3 0 0 1 3 3v10.5a3 3 0 0 1-3 3H6.75a3 3 0 0 1-3-3V6.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroOrb() {
  return (
    <svg
      width="450"
      height="556"
      viewBox="0 0 450 556"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="277" cy="63" r="225" fill="url(#heroPaint0)" />
      <circle cx="18" cy="182" r="18" fill="url(#heroPaint1)" />
      <circle cx="77" cy="288" r="34" fill="url(#heroPaint2)" />
      <circle
        cx="325.486"
        cy="302.87"
        r="180"
        transform="rotate(-37.6852 325.486 302.87)"
        fill="url(#heroPaint3)"
      />
      <circle
        opacity="0.8"
        cx="184.521"
        cy="315.521"
        r="132.862"
        transform="rotate(114.874 184.521 315.521)"
        stroke="url(#heroPaint4)"
      />
      <circle
        opacity="0.8"
        cx="356"
        cy="290"
        r="179.5"
        transform="rotate(-30 356 290)"
        stroke="url(#heroPaint5)"
      />
      <circle
        opacity="0.8"
        cx="191.659"
        cy="302.659"
        r="133.362"
        transform="rotate(133.319 191.659 302.659)"
        fill="url(#heroPaint6)"
      />
      <defs>
        <linearGradient id="heroPaint0" x1="-54.5" y1="-178" x2="222" y2="288" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AA8FF" />
          <stop offset="1" stopColor="#5AA8FF" stopOpacity="0" />
        </linearGradient>
        <radialGradient
          id="heroPaint1"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(18 182) rotate(90) scale(18)"
        >
          <stop offset="0.145833" stopColor="#6D59FF" stopOpacity="0" />
          <stop offset="1" stopColor="#6D59FF" stopOpacity="0.08" />
        </radialGradient>
        <radialGradient
          id="heroPaint2"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(77 288) rotate(90) scale(34)"
        >
          <stop offset="0.145833" stopColor="#6D59FF" stopOpacity="0" />
          <stop offset="1" stopColor="#6D59FF" stopOpacity="0.08" />
        </radialGradient>
        <linearGradient id="heroPaint3" x1="226.775" y1="-66.155" x2="292.157" y2="351.421" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D59FF" />
          <stop offset="1" stopColor="#6D59FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="heroPaint4" x1="184.521" y1="182.159" x2="184.521" y2="448.882" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D59FF" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="heroPaint5" x1="356" y1="110" x2="356" y2="470" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AA8FF" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="heroPaint6" x1="118.524" y1="29.25" x2="166.965" y2="338.63" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AA8FF" />
          <stop offset="1" stopColor="#5AA8FF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeroLines() {
  return (
    <svg
      width="364"
      height="201"
      viewBox="0 0 364 201"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.889 72.33c27.77-5.85 95.508-7.421 144.289 33.097 60.978 50.65 79.412 56.666 114.155 61.18 34.743 4.514 73.385 17.05 98.556 45.633"
        stroke="url(#linePaint0)"
      />
      <path
        d="M-22.11 72.33c27.77-5.85 95.507-7.421 144.288 33.097 60.978 50.65 79.412 56.666 114.155 61.18 34.743 4.514 73.385 17.05 98.556 45.633"
        stroke="url(#linePaint1)"
      />
      <path
        d="M-53.11 72.33c27.77-5.85 95.507-7.421 144.288 33.097 60.978 50.65 79.412 56.666 114.155 61.18 34.743 4.514 73.385 17.05 98.556 45.633"
        stroke="url(#linePaint2)"
      />
      <path
        d="M-98.162 65.089c30.02-5.029 102.895-4.6 154.235 37.343 64.175 52.43 83.832 58.988 121.064 64.525 37.233 5.537 78.438 19.209 104.719 48.525"
        stroke="url(#linePaint3)"
      />
      <circle
        opacity="0.8"
        cx="214.505"
        cy="60.505"
        r="49.72"
        transform="rotate(-13.421 214.505 60.505)"
        stroke="url(#linePaint4)"
      />
      <circle cx="220" cy="63" r="43" fill="url(#linePaint5)" />
      <defs>
        <linearGradient id="linePaint0" x1="184.389" y1="69.24" x2="184.389" y2="212.24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D59FF" stopOpacity="0" />
          <stop offset="1" stopColor="#6D59FF" />
        </linearGradient>
        <linearGradient id="linePaint1" x1="156.389" y1="69.24" x2="156.389" y2="212.24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AA8FF" stopOpacity="0" />
          <stop offset="1" stopColor="#5AA8FF" />
        </linearGradient>
        <linearGradient id="linePaint2" x1="125.389" y1="69.24" x2="125.389" y2="212.24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D59FF" stopOpacity="0" />
          <stop offset="1" stopColor="#6D59FF" />
        </linearGradient>
        <linearGradient id="linePaint3" x1="93.851" y1="67.267" x2="89.928" y2="210.214" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AA8FF" stopOpacity="0" />
          <stop offset="1" stopColor="#5AA8FF" />
        </linearGradient>
        <linearGradient id="linePaint4" x1="214.505" y1="10.285" x2="212.684" y2="99.582" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D59FF" />
          <stop offset="1" stopColor="#6D59FF" stopOpacity="0" />
        </linearGradient>
        <radialGradient
          id="linePaint5"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(220 63) rotate(90) scale(43)"
        >
          <stop offset="0.145833" stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="white" stopOpacity="0.08" />
        </radialGradient>
      </defs>
    </svg>
  );
}

