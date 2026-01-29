import { StatCard } from "@/components/dashboard/StatCard";
import { ManagerShell } from "@/components/manager/ManagerShell";
import { IconAlert, IconCheck, IconFolder, IconSpark } from "@/components/icons";
import { prisma } from "@/lib/prisma";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export default async function ManagerPage() {
  const [
    activeProjects,
    executedCases,
    failedCases,
    totalCases,
    automatedCases,
  ] = await prisma.$transaction([
    prisma.project.count({ where: { isActive: true } }),
    prisma.testRunItem.count({
      where: { status: { not: "not_run" } },
    }),
    prisma.testRunItem.count({
      where: { status: "failed" },
    }),
    prisma.testCase.count(),
    prisma.testCase.count({ where: { isAutomated: true } }),
  ]);

  const automationRate =
    totalCases > 0 ? Math.round((automatedCases / totalCases) * 100) : 0;

  return (
    <ManagerShell>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={formatCount(activeProjects)}
          change="Actualizado hoy"
          icon={<IconFolder className="h-6 w-6 text-brand-700" />}
          accent="bg-brand-50 text-brand-700"
        />
        <StatCard
          title="Cases Executed"
          value={formatCount(executedCases)}
          change="Total histórico"
          icon={<IconCheck className="h-6 w-6 text-success-500" />}
          accent="bg-[#e7faf2] text-success-500"
        />
        <StatCard
          title="Failures"
          value={formatCount(failedCases)}
          change="Total histórico"
          icon={<IconAlert className="h-6 w-6 text-danger-500" />}
          accent="bg-[#ffe9ed] text-danger-500"
        />
        <StatCard
          title="Automation Rate"
          value={`${automationRate}%`}
          change={`Automated: ${formatCount(automatedCases)} / ${formatCount(totalCases)}`}
          icon={<IconSpark className="h-6 w-6 text-accent-600" />}
          accent="bg-[#fff1e9] text-accent-600"
        />
      </section>

    </ManagerShell>
  );
}
