import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { TrendCard } from "@/components/dashboard/TrendCard";
import { SuiteCard } from "@/components/dashboard/SuiteCard";
import { ManagerShell } from "@/components/manager/ManagerShell";
import { IconAlert, IconBug, IconCheck, IconFolder, IconSpark } from "@/components/icons";
import { prisma } from "@/lib/prisma";
import type { GlobalRole, OrgRole, Prisma } from "@/generated/prisma/client";
import { canSync } from "@/lib/auth/can-sync";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export default async function ManagerPage() {
  const session = await getServerSession(authOptions);

  const globalRoles = (session?.user?.globalRoles ?? []) as GlobalRole[];
  const organizationRole = session?.user?.organizationRole as OrgRole | undefined;
  if (!canSync(PERMISSIONS.PROJECT_LIST, globalRoles, organizationRole)) {
    redirect("/manager/organizations");
  }

  const activeOrganizationId = session?.user?.activeOrganizationId as string | undefined;

  // Scope all queries to the active org when present
  const projectWhere: Prisma.ProjectWhereInput = activeOrganizationId
    ? { isActive: true, organizationId: activeOrganizationId }
    : { isActive: true };

  const runItemOrgFilter: Prisma.TestRunItemWhereInput = activeOrganizationId
    ? { run: { project: { organizationId: activeOrganizationId } } }
    : {};

  const testCaseOrgFilter: Prisma.TestCaseWhereInput = activeOrganizationId
    ? { suite: { testPlan: { project: { organizationId: activeOrganizationId } } } }
    : {};

  const bugOrgFilter: Prisma.BugWhereInput = activeOrganizationId
    ? { project: { organizationId: activeOrganizationId } }
    : {};

  const [
    activeProjects,
    executedCases,
    failedCases,
    totalCases,
    automatedCases,
    openBugs,
    criticalBugs,
  ] = await prisma.$transaction([
    prisma.project.count({ where: projectWhere }),
    prisma.testRunItem.count({
      where: { status: { not: "not_run" }, ...runItemOrgFilter },
    }),
    prisma.testRunItem.count({
      where: { status: "failed", ...runItemOrgFilter },
    }),
    prisma.testCase.count({ where: testCaseOrgFilter }),
    prisma.testCase.count({ where: { isAutomated: true, ...testCaseOrgFilter } }),
    prisma.bug.count({
      where: { status: "open", ...bugOrgFilter },
    }),
    prisma.bug.count({
      where: {
        severity: "critical",
        status: { notIn: ["closed", "verified"] },
        ...bugOrgFilter,
      },
    }),
  ]);

  const automationRate =
    totalCases > 0 ? Math.round((automatedCases / totalCases) * 100) : 0;

  return (
    <ManagerShell>
      {!activeOrganizationId ? (
        <section className="mb-5 rounded-2xl border border-warning-500/25 bg-warning-500/10 px-5 py-4 text-warning-500">
          <p className="text-sm font-semibold">No hay una organizacion activa.</p>
          <p className="mt-1 text-sm">
            Selecciona una organizacion para ver metricas y actividad contextual.
          </p>
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Proyectos activos"
          value={formatCount(activeProjects)}
          change="Actualizado hoy"
          icon={<IconFolder className="h-6 w-6 text-brand-700" />}
          accent="bg-brand-50 text-brand-700"
        />
        <StatCard
          title="Casos ejecutados"
          value={formatCount(executedCases)}
          change="Total historico"
          icon={<IconCheck className="h-6 w-6 text-success-500" />}
          accent="bg-[#e7faf2] text-success-500"
        />
        <StatCard
          title="Fallos"
          value={formatCount(failedCases)}
          change="Total historico"
          icon={<IconAlert className="h-6 w-6 text-danger-500" />}
          accent="bg-[#ffe9ed] text-danger-500"
        />
        <StatCard
          title="Automatizacion"
          value={`${automationRate}%`}
          change={`Automatizados: ${formatCount(automatedCases)} / ${formatCount(totalCases)}`}
          icon={<IconSpark className="h-6 w-6 text-accent-600" />}
          accent="bg-[#fff1e9] text-accent-600"
        />
        <StatCard
          title="Bugs abiertos"
          value={formatCount(openBugs)}
          change={`${criticalBugs} criticos`}
          icon={<IconBug className="h-6 w-6 text-danger-500" />}
          accent="bg-[#ffe9ed] text-danger-500"
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_1fr_1fr]">
        <ActivityCard />
        <TrendCard />
        <SuiteCard />
      </section>
    </ManagerShell>
  );
}
