import { prisma } from "@/lib/prisma";

export type BugReferenceInput = {
  projectId: string;
  organizationId: string;
  assignedToId?: string | null;
  testCaseId?: string | null;
  testRunId?: string | null;
  testRunItemId?: string | null;
};

export type BugReferenceError = {
  ok: false;
  field: "assignedToId" | "testCaseId" | "testRunId" | "testRunItemId";
  message: string;
};

export type BugReferenceOk = { ok: true };

export type BugReferenceResult = BugReferenceOk | BugReferenceError;

// Validates that every optional foreign key on a bug payload belongs to the
// caller's organization/project. Without this check the route accepts
// arbitrary ids via Prisma `connect`, which leaks cross-tenant data through
// the bug's joined relations (assignedTo email, test run name, etc.).
export async function validateBugReferences(
  input: BugReferenceInput,
): Promise<BugReferenceResult> {
  const { projectId, organizationId } = input;

  if (input.assignedToId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: input.assignedToId,
        },
      },
      select: { userId: true },
    });
    if (!membership) {
      return {
        ok: false,
        field: "assignedToId",
        message: "Assignee is not a member of this organization.",
      };
    }
  }

  if (input.testCaseId) {
    const testCase = await prisma.testCase.findUnique({
      where: { id: input.testCaseId },
      select: {
        suite: {
          select: { testPlan: { select: { projectId: true } } },
        },
      },
    });
    if (!testCase || testCase.suite.testPlan.projectId !== projectId) {
      return {
        ok: false,
        field: "testCaseId",
        message: "Test case does not belong to this project.",
      };
    }
  }

  if (input.testRunId) {
    const run = await prisma.testRun.findUnique({
      where: { id: input.testRunId },
      select: { projectId: true },
    });
    if (!run || run.projectId !== projectId) {
      return {
        ok: false,
        field: "testRunId",
        message: "Test run does not belong to this project.",
      };
    }
  }

  if (input.testRunItemId) {
    const item = await prisma.testRunItem.findUnique({
      where: { id: input.testRunItemId },
      select: { run: { select: { projectId: true } } },
    });
    if (!item || item.run.projectId !== projectId) {
      return {
        ok: false,
        field: "testRunItemId",
        message: "Test run item does not belong to this project.",
      };
    }
  }

  return { ok: true };
}
