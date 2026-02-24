import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { BugSeverityChart } from "@/components/dashboard/BugSeverityChart";
import { TestStatusChart } from "@/components/dashboard/TestStatusChart";
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

function statusTone(s: string): "success" | "danger" | "warning" | "neutral" {
  if (s === "passed") return "success";
  if (s === "failed") return "danger";
  if (s === "blocked") return "warning";
  return "neutral";
}

function statusLabel(s: string): string {
  const labels: Record<string, string> = {
    passed: "Completado",
    failed: "Fallido",
    blocked: "Bloqueado",
    skipped: "Omitido",
    not_run: "Pendiente",
    completed: "Completado",
    running: "En curso",
    queued: "En cola",
    canceled: "Cancelado",
  };
  return labels[s] ?? s;
}

export default async function ManagerPage() {
  const session = await getServerSession(authOptions);

  const globalRoles = (session?.user?.globalRoles ?? []) as GlobalRole[];
  const organizationRole = session?.user?.organizationRole as OrgRole | undefined;
  if (!canSync(PERMISSIONS.PROJECT_LIST, globalRoles, organizationRole)) {
    redirect("/manager/organizations");
  }

  const activeOrganizationId = session?.user?.activeOrganizationId as string | undefined;

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

  // ── Core metrics ──────────────────────────────────────────
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

  // ── Trend data (last 7 days) ──────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recentItems = await prisma.testRunItem.findMany({
    where: {
      executedAt: { gte: sevenDaysAgo },
      status: { in: ["passed", "failed"] },
      ...runItemOrgFilter,
    },
    select: { executedAt: true, status: true },
  });

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const trendMap = new Map<string, { passed: number; failed: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { passed: 0, failed: 0 });
  }
  for (const item of recentItems) {
    if (!item.executedAt) continue;
    const key = item.executedAt.toISOString().slice(0, 10);
    const entry = trendMap.get(key);
    if (entry) {
      if (item.status === "passed") entry.passed++;
      else entry.failed++;
    }
  }
  const trendData = Array.from(trendMap.entries()).map(([dateStr, counts]) => ({
    day: dayNames[new Date(dateStr).getUTCDay()],
    ...counts,
  }));

  // ── Bug severity distribution ─────────────────────────────
  const bugsBySeverity = await prisma.bug.groupBy({
    by: ["severity"],
    where: { status: { notIn: ["closed", "verified"] }, ...bugOrgFilter },
    _count: true,
  });

  const severityColors: Record<string, string> = {
    critical: "#DC2626",
    high: "#F97316",
    medium: "#EAB308",
    low: "#22C55E",
  };
  const severityLabels: Record<string, string> = {
    critical: "Crítico",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
  };

  const bugSeverityData = ["critical", "high", "medium", "low"].map((sev) => {
    const found = bugsBySeverity.find((b) => b.severity === sev);
    return {
      name: severityLabels[sev] ?? sev,
      value: found?._count ?? 0,
      color: severityColors[sev] ?? "#94A3B8",
    };
  }).filter((d) => d.value > 0);

  const totalBugsSeverity = bugSeverityData.reduce((sum, d) => sum + d.value, 0);

  // ── Test result distribution ──────────────────────────────
  const resultsByStatus = await prisma.testRunItem.groupBy({
    by: ["status"],
    where: runItemOrgFilter,
    _count: true,
  });

  const statusColors: Record<string, string> = {
    passed: "#059669",
    failed: "#DC2626",
    skipped: "#94A3B8",
    blocked: "#F59E0B",
    not_run: "#D1D5DB",
  };
  const statusLabels: Record<string, string> = {
    passed: "Passed",
    failed: "Failed",
    skipped: "Skipped",
    blocked: "Blocked",
    not_run: "Not run",
  };

  const testStatusData = ["passed", "failed", "blocked", "skipped", "not_run"].map((s) => {
    const found = resultsByStatus.find((r) => r.status === s);
    return {
      name: statusLabels[s] ?? s,
      value: found?._count ?? 0,
      color: statusColors[s] ?? "#94A3B8",
    };
  }).filter((d) => d.value > 0);

  const totalResultItems = testStatusData.reduce((sum, d) => sum + d.value, 0);

  // ── Latest test runs ──────────────────────────────────────
  const runOrgFilter: Prisma.TestRunWhereInput = activeOrganizationId
    ? { project: { organizationId: activeOrganizationId } }
    : {};

  const latestRuns = await prisma.testRun.findMany({
    where: runOrgFilter,
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { name: true, status: true, testPlan: { select: { name: true } } },
  });

  const runItems = latestRuns.map((run) => ({
    title: run.name ?? run.testPlan?.name ?? "Sin nombre",
    status: statusLabel(run.status),
    tone: statusTone(
      run.status === "completed" ? "passed" : run.status === "failed" ? "failed" : run.status
    ),
  }));

  const totalExecuted = executedCases || 1;
  const pipelinePassRate = Math.round(((totalExecuted - failedCases) / totalExecuted) * 100);

  // ── Top suites ────────────────────────────────────────────
  const topSuites = await prisma.testRunItem.groupBy({
    by: ["testCaseId"],
    where: { status: { not: "not_run" }, ...runItemOrgFilter },
    _count: true,
    orderBy: { _count: { testCaseId: "desc" } },
    take: 20,
  });

  // resolve suite names from testCaseIds
  const caseIds = topSuites.map((s) => s.testCaseId);
  const casesWithSuites = caseIds.length > 0
    ? await prisma.testCase.findMany({
      where: { id: { in: caseIds } },
      select: { id: true, suite: { select: { name: true } } },
    })
    : [];

  const suiteCountMap = new Map<string, number>();
  for (const ts of topSuites) {
    const tc = casesWithSuites.find((c) => c.id === ts.testCaseId);
    const suiteName = tc?.suite?.name ?? "Sin suite";
    suiteCountMap.set(suiteName, (suiteCountMap.get(suiteName) ?? 0) + ts._count);
  }

  const topSuiteData = Array.from(suiteCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      cases: count,
      trend: `${count}`,
    }));

  return (
    <ManagerShell>
      {!activeOrganizationId ? (
        <section className="mb-5 rounded-2xl border border-warning-500/25 bg-warning-500/10 px-5 py-4 text-warning-500">
          <p className="text-sm font-semibold">No hay una organización activa.</p>
          <p className="mt-1 text-sm">
            Selecciona una organización para ver métricas y actividad contextual.
          </p>
        </section>
      ) : null}

      {/* ── Stat cards ─────────────────────────────────────── */}
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
          change="Total histórico"
          icon={<IconCheck className="h-6 w-6 text-success-500" />}
          accent="bg-[#ECFDF5] text-success-500"
        />
        <StatCard
          title="Fallos"
          value={formatCount(failedCases)}
          change="Total histórico"
          icon={<IconAlert className="h-6 w-6 text-danger-500" />}
          accent="bg-[#FEF2F2] text-danger-500"
        />
        <StatCard
          title="Automatización"
          value={`${automationRate}%`}
          change={`Automatizados: ${formatCount(automatedCases)} / ${formatCount(totalCases)}`}
          icon={<IconSpark className="h-6 w-6 text-accent-600" />}
          accent="bg-[#EFF6FF] text-accent-600"
        />
        <StatCard
          title="Bugs abiertos"
          value={formatCount(openBugs)}
          change={`${criticalBugs} críticos`}
          icon={<IconBug className="h-6 w-6 text-danger-500" />}
          accent="bg-[#FEF2F2] text-danger-500"
        />
      </section>

      {/* ── Charts row ─────────────────────────────────────── */}
      <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <TrendChart data={trendData} />
        <BugSeverityChart data={bugSeverityData} total={totalBugsSeverity} />
        <TestStatusChart data={testStatusData} total={totalResultItems} />
      </section>

      {/* ── Detail row ─────────────────────────────────────── */}
      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ActivityCard runs={runItems} passRate={pipelinePassRate} />
        <SuiteCard suites={topSuiteData} />
      </section>
    </ManagerShell>
  );
}
