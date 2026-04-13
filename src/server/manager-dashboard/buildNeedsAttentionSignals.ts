import { formatCount } from "./helpers";
import type { NeedsAttentionSignal, TopProblemAreaSuite } from "./types";

type BuildNeedsAttentionSignalsInput = {
  passRateDeltaVsPreviousRun: number | null;
  latestBlockedCases: number;
  unstableSuites: TopProblemAreaSuite[];
  openCriticalHighBugs: number;
  readyWithoutRecentExecution: number;
};

export function buildNeedsAttentionSignals({
  passRateDeltaVsPreviousRun,
  latestBlockedCases,
  unstableSuites,
  openCriticalHighBugs,
  readyWithoutRecentExecution,
}: BuildNeedsAttentionSignalsInput): NeedsAttentionSignal[] {
  const signals: NeedsAttentionSignal[] = [];

  if (passRateDeltaVsPreviousRun !== null && passRateDeltaVsPreviousRun < 0) {
    signals.push({
      id: "pass-rate-drop-vs-previous-run",
      title: "Pass rate drop vs previous run",
      detail: `${Math.abs(passRateDeltaVsPreviousRun)}% lower than the previous manual run.`,
      cta: "Review failed cases from the latest run and compare changes.",
      tone: "danger",
    });
  }

  if (latestBlockedCases > 0) {
    signals.push({
      id: "blocked-cases-latest-run",
      title: "Blocked cases in latest run",
      detail: `${formatCount(latestBlockedCases)} blocked case(s) detected in the latest manual run.`,
      cta: "Unblock dependencies and retest blocked scenarios first.",
      tone: "warning",
    });
  }

  if (unstableSuites.length > 0 && unstableSuites[0] && unstableSuites[0].failedCount > 0) {
    const topSuite = unstableSuites[0];
    signals.push({
      id: "suites-with-most-failures",
      title: "Suite with highest failures",
      detail: `${topSuite.suiteName} accumulated ${formatCount(topSuite.failedCount)} failure(s) in the recent period.`,
      cta: "Prioritize this suite for failure analysis and stabilization.",
      tone: "warning",
    });
  }

  if (openCriticalHighBugs > 0) {
    signals.push({
      id: "open-critical-high-bugs",
      title: "Open critical/high bugs",
      detail: `${formatCount(openCriticalHighBugs)} critical/high defect(s) remain open.`,
      cta: "Focus triage on high-impact defects before next run.",
      tone: "danger",
    });
  }

  if (readyWithoutRecentExecution > 0) {
    signals.push({
      id: "ready-without-recent-execution",
      title: "Ready cases without recent execution",
      detail: `${formatCount(readyWithoutRecentExecution)} ready case(s) were not executed in the last 7 days.`,
      cta: "Schedule a manual run to increase execution coverage.",
      tone: "info",
    });
  }

  return signals.slice(0, 5);
}
