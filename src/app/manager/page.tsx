import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { TestStatusChart } from "@/components/dashboard/TestStatusChart";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import {
  IconAlert,
  IconBug,
  IconChart,
  IconFolder,
  IconPlay,
} from "@/components/icons";
import { prisma } from "@/lib/prisma";
import type { GlobalRole, OrgRole, Prisma } from "@/generated/prisma/client";
import { canSync } from "@/lib/auth/can-sync";
import { PERMISSIONS } from "@/lib/auth/permissions.constants";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

function statusTone(s: string): "success" | "danger" | "warning" | "neutral" {
  if (s === "completed") return "success";
  if (s === "failed") return "danger";
  if (s === "running") return "warning";
  return "neutral";
}

function statusLabel(s: string): string {
  const labels: Record<string, string> = {
    completed: "Completado",
    failed: "Fallido",
    running: "En curso",
    queued: "En cola",
    canceled: "Cancelado",
  };
  return labels[s] ?? s;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const mins = Math.max(1, Math.round(diff / minute));
    return `hace ${mins} min`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `hace ${hours} h`;
  }
  const days = Math.round(diff / day);
  return `hace ${days} d`;
}

function formatDuration(durationMs?: number | bigint | null, startedAt?: Date | null, finishedAt?: Date | null) {
  let ms = durationMs ? Number(durationMs) : 0;

  if (!ms && startedAt && finishedAt) {
    ms = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  }

  if (!ms) return "Sin duración";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
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

  const bugOrgFilter: Prisma.BugWhereInput = activeOrganizationId
    ? { project: { organizationId: activeOrganizationId } }
    : {};

  const runOrgFilter: Prisma.TestRunWhereInput = activeOrganizationId
    ? { project: { organizationId: activeOrganizationId } }
    : {};

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const previousWeekStart = new Date(sevenDaysAgo);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const [
    activeProjects,
    executedCases,
    failedCases,
    openBugs,
    criticalBugs,
    runningRuns,
    recentRunsCount,
    recentItems,
    previousItems,
    passedResults,
    failedResults,
    blockedResults,
    skippedResults,
    notRunResults,
    latestRuns,
    recentFailedRuns,
  ] = await prisma.$transaction([
    prisma.project.count({ where: projectWhere }),
    prisma.testRunItem.count({
      where: { status: { not: "not_run" }, ...runItemOrgFilter },
    }),
    prisma.testRunItem.count({
      where: { status: "failed", ...runItemOrgFilter },
    }),
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
    prisma.testRun.count({
      where: { status: "running", ...runOrgFilter },
    }),
    prisma.testRun.count({
      where: { createdAt: { gte: oneDayAgo }, ...runOrgFilter },
    }),
    prisma.testRunItem.findMany({
      where: {
        executedAt: { gte: sevenDaysAgo },
        status: { in: ["passed", "failed"] },
        ...runItemOrgFilter,
      },
      select: { executedAt: true, status: true },
    }),
    prisma.testRunItem.findMany({
      where: {
        executedAt: { gte: previousWeekStart, lt: sevenDaysAgo },
        status: { in: ["passed", "failed"] },
        ...runItemOrgFilter,
      },
      select: { status: true },
    }),
    prisma.testRunItem.count({ where: { status: "passed", ...runItemOrgFilter } }),
    prisma.testRunItem.count({ where: { status: "failed", ...runItemOrgFilter } }),
    prisma.testRunItem.count({ where: { status: "blocked", ...runItemOrgFilter } }),
    prisma.testRunItem.count({ where: { status: "skipped", ...runItemOrgFilter } }),
    prisma.testRunItem.count({ where: { status: "not_run", ...runItemOrgFilter } }),
    prisma.testRun.findMany({
      where: runOrgFilter,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        environment: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        testPlan: { select: { name: true } },
        suite: { select: { name: true } },
        metrics: {
          select: {
            total: true,
            passed: true,
            failed: true,
            passRate: true,
            durationMs: true,
          },
        },
      },
    }),
    prisma.testRun.findMany({
      where: { status: "failed", createdAt: { gte: sevenDaysAgo }, ...runOrgFilter },
      select: { suite: { select: { name: true } } },
      take: 50,
    }),
  ]);

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
    if (!entry) continue;
    if (item.status === "passed") entry.passed += 1;
    if (item.status === "failed") entry.failed += 1;
  }

  const trendData = Array.from(trendMap.entries()).map(([dateStr, counts]) => ({
    day: dayNames[new Date(dateStr).getUTCDay()],
    ...counts,
  }));

  const thisWeekPassed = recentItems.filter((item) => item.status === "passed").length;
  const thisWeekFailed = recentItems.filter((item) => item.status === "failed").length;
  const thisWeekTotal = thisWeekPassed + thisWeekFailed;
  const thisWeekPassRate = thisWeekTotal > 0 ? Math.round((thisWeekPassed / thisWeekTotal) * 100) : 0;

  const previousWeekPassed = previousItems.filter((item) => item.status === "passed").length;
  const previousWeekFailed = previousItems.filter((item) => item.status === "failed").length;
  const previousWeekTotal = previousWeekPassed + previousWeekFailed;
  const previousWeekPassRate = previousWeekTotal > 0 ? Math.round((previousWeekPassed / previousWeekTotal) * 100) : 0;
  const passRateDelta = thisWeekPassRate - previousWeekPassRate;

  const statusColors: Record<string, string> = {
    passed: "#059669",
    failed: "#DC2626",
    skipped: "#94A3B8",
    blocked: "#D97706",
    not_run: "#D1D5DB",
  };

  const statusLabels: Record<string, string> = {
    passed: "Passed",
    failed: "Failed",
    skipped: "Skipped",
    blocked: "Blocked",
    not_run: "Not run",
  };

  const orderedStatuses = ["passed", "failed", "blocked", "skipped", "not_run"];
  const countsByStatus = new Map<string, number>([
    ["passed", passedResults],
    ["failed", failedResults],
    ["blocked", blockedResults],
    ["skipped", skippedResults],
    ["not_run", notRunResults],
  ]);

  const totalResultItems = orderedStatuses.reduce((sum, status) => sum + (countsByStatus.get(status) ?? 0), 0);
  const executedResultItems = totalResultItems - (countsByStatus.get("not_run") ?? 0);
  const passRateGlobal = executedResultItems > 0
    ? Math.round(((countsByStatus.get("passed") ?? 0) / executedResultItems) * 100)
    : 0;

  const testStatusData = orderedStatuses.map((status) => {
    const value = countsByStatus.get(status) ?? 0;
    const percentage = totalResultItems > 0 ? Math.round((value / totalResultItems) * 100) : 0;
    return {
      name: statusLabels[status] ?? status,
      value,
      percentage,
      color: statusColors[status] ?? "#94A3B8",
    };
  });

  const totalExecuted = executedCases || 1;
  const pipelinePassRate = Math.round(((totalExecuted - failedCases) / totalExecuted) * 100);
  const failedPeak = trendData.reduce<{ day: string; failed: number } | null>((peak, day) => {
    if (day.failed === 0) return peak;
    if (!peak || day.failed > peak.failed) {
      return { day: day.day, failed: day.failed };
    }
    return peak;
  }, null);

  const suiteFailures = recentFailedRuns.reduce<Record<string, number>>((acc, run) => {
    const suiteName = run.suite?.name;
    if (!suiteName) return acc;
    acc[suiteName] = (acc[suiteName] ?? 0) + 1;
    return acc;
  }, {});

  const topUnstableSuite = Object.entries(suiteFailures).sort((a, b) => b[1] - a[1])[0];

  const attentionItems: {
    id: string;
    title: string;
    detail: string;
    cta: string;
    tone: "danger" | "warning" | "info";
  }[] = [];

  if (passRateDelta < 0) {
    attentionItems.push({
      id: "pass-rate-drop",
      title: "Caída del pass rate semanal",
      detail: `${Math.abs(passRateDelta)}% por debajo de la semana anterior (${thisWeekPassRate}% actual).`,
      cta: "Revisar runs fallidos recientes y cambios de entorno.",
      tone: "danger",
    });
  }

  if (criticalBugs > 0) {
    attentionItems.push({
      id: "critical-bugs",
      title: "Bugs críticos abiertos",
      detail: `${formatCount(criticalBugs)} incidencias críticas pendientes de cierre.`,
      cta: "Priorizar triage y asignaciones del backlog crítico.",
      tone: "danger",
    });
  }

  if (topUnstableSuite && topUnstableSuite[1] >= 2) {
    attentionItems.push({
      id: "unstable-suite",
      title: "Suite inestable detectada",
      detail: `${topUnstableSuite[0]} acumuló ${topUnstableSuite[1]} fallos en los últimos 7 días.`,
      cta: "Analizar flaky tests y dependencias de la suite.",
      tone: "warning",
    });
  }

  if (runningRuns > 0) {
    attentionItems.push({
      id: "active-runs",
      title: "Ejecuciones activas en progreso",
      detail: `${runningRuns} ejecución(es) están corriendo en este momento.`,
      cta: "Monitorear duración y estabilidad de pipelines activos.",
      tone: "info",
    });
  }

  const runItems = latestRuns.map((run) => {
    const title = run.name?.trim() || run.testPlan?.name || `Run ${run.id.slice(0, 6)}`;
    const suite = run.suite?.name || "Suite no definida";
    const metrics = run.metrics;
    const tests = metrics
      ? `${metrics.total} tests`
      : "Sin métricas";
    const runPassRate = metrics ? Math.round(toNumber(metrics.passRate)) : null;
    const outcome = metrics
      ? `${metrics.passed}/${metrics.total} passed${metrics.failed > 0 ? ` · ${metrics.failed} failed` : ""}${runPassRate !== null ? ` · ${runPassRate}%` : ""}`
      : "Sin resultados consolidados";

    return {
      id: run.id,
      title,
      suite,
      environment: run.environment || "Sin entorno",
      when: formatRelativeTime(run.startedAt ?? run.createdAt),
      duration: formatDuration(metrics?.durationMs ?? null, run.startedAt, run.finishedAt),
      tests,
      outcome,
      status: statusLabel(run.status),
      tone: statusTone(run.status),
    };
  });

  const weekSummary = `${formatCount(thisWeekTotal)} casos ejecutados (${formatCount(thisWeekFailed)} fallidos)`;

  return (
    <>
      {!activeOrganizationId ? (
        <section className="mb-5 rounded-2xl border border-warning-500/25 bg-warning-500/10 px-5 py-4 text-warning-500">
          <p className="text-sm font-semibold">No hay una organización activa.</p>
          <p className="mt-1 text-sm">
            Selecciona una organización para ver métricas y actividad contextual.
          </p>
        </section>
      ) : null}

      <section className="space-y-5">
        <div>
          <StatCard
            emphasized
            label="Pipeline health"
            value={`${pipelinePassRate}%`}
            supportText={`${formatCount(failedCases)} fallidos de ${formatCount(executedCases)} casos ejecutados`}
            microInsight={passRateDelta === 0 ? "Sin variación respecto a la semana anterior" : `${passRateDelta > 0 ? "+" : ""}${passRateDelta}% vs semana anterior`}
            statusBadge={{
              tone: pipelinePassRate >= 90 ? "success" : pipelinePassRate >= 75 ? "warning" : "danger",
              label: pipelinePassRate >= 90 ? "Estable" : pipelinePassRate >= 75 ? "Riesgo" : "Crítico",
            }}
            icon={<IconChart className="h-6 w-6 text-brand-700" />}
            accentClassName="bg-brand-100/80 text-brand-700"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Proyectos activos"
            value={formatCount(activeProjects)}
            supportText="Portfolio actual en operación"
            microInsight={`${formatCount(recentRunsCount)} runs en las últimas 24h`}
            statusBadge={{ tone: "info", label: "Seguimiento" }}
            icon={<IconFolder className="h-5 w-5 text-brand-700" />}
            accentClassName="bg-brand-50 text-brand-700"
          />
          <StatCard
            label="Ejecuciones activas"
            value={formatCount(runningRuns)}
            supportText="Pipelines en curso ahora"
            microInsight={`${formatCount(thisWeekTotal)} ejecuciones de casos esta semana`}
            statusBadge={{ tone: runningRuns > 0 ? "warning" : "neutral", label: runningRuns > 0 ? "En curso" : "Sin actividad" }}
            icon={<IconPlay className="h-5 w-5 text-warning-500" />}
            accentClassName="bg-warning-500/10 text-warning-500"
          />
          <StatCard
            label="Bugs abiertos"
            value={formatCount(openBugs)}
            supportText={`${formatCount(criticalBugs)} críticos pendientes`}
            microInsight="Control de riesgo y estabilidad funcional"
            statusBadge={{ tone: criticalBugs > 0 ? "danger" : "success", label: criticalBugs > 0 ? "Atención" : "Controlado" }}
            icon={<IconBug className="h-5 w-5 text-danger-500" />}
            accentClassName="bg-danger-100 text-danger-500"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <TrendChart
          data={trendData}
          period="weekly"
          summary={weekSummary}
          subtitle="Evolución semanal de casos aprobados y fallidos"
          failedPeak={failedPeak}
        />
        <div className="grid gap-5">
          <TestStatusChart data={testStatusData} total={totalResultItems} passRate={passRateGlobal} />
          <NeedsAttentionCard items={attentionItems.slice(0, 3)} />
        </div>
      </section>

      <section className="mt-6">
        <ActivityCard runs={runItems} passRate={pipelinePassRate} />
      </section>

      <section className="mt-4 rounded-xl border border-stroke bg-surface-elevated/90 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <IconAlert className="h-4 w-4 text-ink-soft" />
          <span>
            {attentionItems.length > 0
              ? `${attentionItems.length} señal(es) activa(s) en observación.`
              : "Sin señales críticas activas en este momento."}
          </span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-ink-soft">
            Última actualización: {new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </section>
    </>
  );
}
