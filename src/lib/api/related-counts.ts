import { prisma } from "@/lib/prisma";

export type ProjectRelatedCounts = {
  testPlans: number;
  testSuites: number;
  testCases: number;
  testRuns: number;
  bugs: number;
};

export type TestPlanRelatedCounts = {
  testSuites: number;
  testCases: number;
  testRuns: number;
};

export type TestSuiteRelatedCounts = {
  childSuites: number;
  testCases: number;
};

export async function getProjectRelatedCounts(
  projectId: string,
): Promise<ProjectRelatedCounts> {
  const [testPlans, testSuites, testCases, testRuns, bugs] = await Promise.all([
    prisma.testPlan.count({ where: { projectId } }),
    prisma.testSuite.count({ where: { testPlan: { projectId } } }),
    prisma.testCase.count({ where: { suite: { testPlan: { projectId } } } }),
    prisma.testRun.count({ where: { projectId } }),
    prisma.bug.count({ where: { projectId } }),
  ]);
  return { testPlans, testSuites, testCases, testRuns, bugs };
}

export async function getTestPlanRelatedCounts(
  testPlanId: string,
): Promise<TestPlanRelatedCounts> {
  const [testSuites, testCases, testRuns] = await Promise.all([
    prisma.testSuite.count({ where: { testPlanId } }),
    prisma.testCase.count({ where: { suite: { testPlanId } } }),
    prisma.testRun.count({ where: { testPlanId } }),
  ]);
  return { testSuites, testCases, testRuns };
}

export async function getTestSuiteRelatedCounts(
  testSuiteId: string,
): Promise<TestSuiteRelatedCounts> {
  const [childSuites, testCases] = await Promise.all([
    prisma.testSuite.count({ where: { parentSuiteId: testSuiteId } }),
    prisma.testCase.count({ where: { suiteId: testSuiteId } }),
  ]);
  return { childSuites, testCases };
}

export function hasAnyRelated(
  counts: ProjectRelatedCounts | TestPlanRelatedCounts | TestSuiteRelatedCounts,
): boolean {
  return Object.values(counts).some((v) => v > 0);
}

const LABELS: Record<string, string> = {
  testPlans: "test plans",
  testSuites: "test suites",
  testCases: "test cases",
  testRuns: "test runs",
  bugs: "bugs",
  childSuites: "child suites",
};

export function formatRelatedMessage(
  entityName: string,
  counts: ProjectRelatedCounts | TestPlanRelatedCounts | TestSuiteRelatedCounts,
): string {
  const parts = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${LABELS[k] ?? k}`);

  return `Cannot delete the ${entityName}. It has ${parts.join(", ")}.`;
}
