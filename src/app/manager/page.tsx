import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { MonthlyCard } from "@/components/dashboard/MonthlyCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { SuiteCard } from "@/components/dashboard/SuiteCard";
import { TrendCard } from "@/components/dashboard/TrendCard";
import { ManagerShell } from "@/components/manager/ManagerShell";
import {
  IconAlert,
  IconCheck,
  IconFolder,
  IconPlay,
  IconSpark,
} from "@/components/icons";

export default function ManagerPage() {
  return (
    <ManagerShell>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Projects"
          value="18"
          change="+2 this week"
          icon={<IconFolder className="h-6 w-6 text-brand-700" />}
          accent="bg-brand-50 text-brand-700"
        />
        <StatCard
          title="Cases Executed"
          value="4,562"
          change="+14% vs last week"
          icon={<IconCheck className="h-6 w-6 text-success-500" />}
          accent="bg-[#e7faf2] text-success-500"
        />
        <StatCard
          title="Failures"
          value="38"
          change="-6% vs last week"
          icon={<IconAlert className="h-6 w-6 text-danger-500" />}
          accent="bg-[#ffe9ed] text-danger-500"
        />
        <StatCard
          title="Automation Rate"
          value="62%"
          change="+4% this month"
          icon={<IconSpark className="h-6 w-6 text-accent-600" />}
          accent="bg-[#fff1e9] text-accent-600"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <TrendCard />
        <ProgressCard
          title="Release Quality Score"
          percent={86}
          detail="Weighted pass rate across all suites"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr_0.8fr]">
        <ActivityCard />
        <SuiteCard />
        <MonthlyCard />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/70 bg-white/80 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                Upcoming Test Plans
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Planned executions this week
              </p>
            </div>
            <button className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700">
              View all
            </button>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {[
              "Release candidate 5.2",
              "Payments regression",
              "Mobile sanity sweep",
              "Accessibility audit",
            ].map((plan, index) => (
              <div
                key={plan}
                  className="flex items-center justify-between rounded-lg border border-stroke bg-white px-4 py-3 text-sm"
              >
                <span className="font-semibold text-ink">{plan}</span>
                <span className="text-xs text-ink-muted">
                  {index + 1} day(s)
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Automation Pulse</p>
              <p className="mt-1 text-xs text-ink-muted">
                Pipelines connected
              </p>
            </div>
            <button className="flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white">
              <IconPlay className="h-3 w-3 text-white" />
              Trigger run
            </button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { label: "UI Regression", value: "Healthy" },
              { label: "API Smoke", value: "Running" },
              { label: "E2E Checkout", value: "Queued" },
              { label: "Mobile CI", value: "Healthy" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-stroke bg-surface-muted/70 px-4 py-4"
              >
                <p className="text-xs text-ink-soft">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ManagerShell>
  );
}
