/** @jest-environment node */
import { computeRunMetrics } from "./test-runs";

type MockDb = {
  testRunItemExecution: {
    groupBy: jest.Mock;
    aggregate: jest.Mock;
  };
  testRunItem: {
    findMany: jest.Mock;
  };
  testRunArtifact: {
    findMany: jest.Mock;
  };
};

function createDbMock(): MockDb {
  return {
    testRunItemExecution: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    testRunItem: {
      findMany: jest.fn(),
    },
    testRunArtifact: {
      findMany: jest.fn(),
    },
  };
}

describe("computeRunMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("counts all execution attempts including legacy execution_state attempts", async () => {
    const db = createDbMock();

    db.testRunItemExecution.groupBy
      .mockResolvedValueOnce([
        { status: "passed", _count: { _all: 2 } },
        { status: "failed", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { runItemId: "item-1", _max: { attemptNumber: 1 } },
      ]);

    db.testRunItemExecution.aggregate.mockResolvedValue({
      _sum: { durationMs: 1800 },
    });

    db.testRunItem.findMany.mockResolvedValue([{ id: "item-2" }]);

    db.testRunArtifact.findMany.mockResolvedValue([
      {
        runItemId: "item-1",
        metadata: { kind: "execution_state", attemptNumber: 2, status: "passed" },
      },
      {
        runItemId: "item-1",
        metadata: { kind: "execution_state", attemptNumber: 3, status: "failed" },
      },
      {
        runItemId: "item-3",
        metadata: { kind: "execution_state", attemptNumber: 1, status: "skipped" },
      },
    ]);

    const metrics = await computeRunMetrics(db as never, "run-1");

    expect(metrics.total).toBe(7);
    expect(metrics.passed).toBe(3);
    expect(metrics.failed).toBe(2);
    expect(metrics.skipped).toBe(1);
    expect(metrics.blocked).toBe(0);
    expect(metrics.notRun).toBe(1);
    expect(metrics.passRate.toFixed(2)).toBe("42.86");
    expect(metrics.durationMs).toBe(1800n);
  });

  it("does not double-count not_run items when legacy execution snapshots exist", async () => {
    const db = createDbMock();

    db.testRunItemExecution.groupBy
      .mockResolvedValueOnce([
        { status: "not_run", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { runItemId: "item-a", _max: { attemptNumber: 1 } },
      ]);

    db.testRunItemExecution.aggregate.mockResolvedValue({
      _sum: { durationMs: null },
    });

    db.testRunItem.findMany.mockResolvedValue([{ id: "item-b" }, { id: "item-c" }]);

    db.testRunArtifact.findMany.mockResolvedValue([
      {
        runItemId: "item-b",
        metadata: { kind: "execution_state", attemptNumber: 1, status: "passed" },
      },
    ]);

    const metrics = await computeRunMetrics(db as never, "run-2");

    expect(metrics.total).toBe(3);
    expect(metrics.passed).toBe(1);
    expect(metrics.failed).toBe(0);
    expect(metrics.skipped).toBe(0);
    expect(metrics.blocked).toBe(0);
    expect(metrics.notRun).toBe(2);
    expect(metrics.passRate.toFixed(2)).toBe("33.33");
    expect(metrics.durationMs).toBeNull();
  });
});
