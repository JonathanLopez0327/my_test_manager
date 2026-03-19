-- Add new execution status
ALTER TYPE "TestResultStatus" ADD VALUE IF NOT EXISTS 'in_progress';

-- Add current execution pointer to test run items
ALTER TABLE "test_run_items"
ADD COLUMN IF NOT EXISTS "current_execution_id" UUID;

-- Create execution attempts table
CREATE TABLE IF NOT EXISTS "test_run_item_executions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_item_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status" "TestResultStatus" NOT NULL DEFAULT 'not_run',
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "duration_ms" INTEGER,
  "executed_by" UUID,
  "summary" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_execution_run_item" FOREIGN KEY ("run_item_id") REFERENCES "test_run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_execution_executed_by" FOREIGN KEY ("executed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create step results table
CREATE TABLE IF NOT EXISTS "test_run_item_execution_step_results" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "execution_id" UUID NOT NULL,
  "step_index" INTEGER NOT NULL,
  "step_text_snapshot" TEXT NOT NULL,
  "expected_snapshot" TEXT,
  "status" "TestResultStatus" NOT NULL DEFAULT 'not_run',
  "actual_result" TEXT,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_execution_step_execution" FOREIGN KEY ("execution_id") REFERENCES "test_run_item_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add execution linkage on artifacts for per-attempt evidence
ALTER TABLE "test_run_artifacts"
ADD COLUMN IF NOT EXISTS "execution_id" UUID;

ALTER TABLE "test_run_artifacts"
ADD CONSTRAINT "fk_artifact_execution" FOREIGN KEY ("execution_id") REFERENCES "test_run_item_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "uq_run_item_attempt_number" ON "test_run_item_executions" ("run_item_id", "attempt_number");
CREATE INDEX IF NOT EXISTS "idx_execution_run_item_attempt_desc" ON "test_run_item_executions" ("run_item_id", "attempt_number" DESC);
CREATE INDEX IF NOT EXISTS "idx_execution_status" ON "test_run_item_executions" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_execution_step_index" ON "test_run_item_execution_step_results" ("execution_id", "step_index");
CREATE INDEX IF NOT EXISTS "idx_execution_step_result_execution_step" ON "test_run_item_execution_step_results" ("execution_id", "step_index");
CREATE INDEX IF NOT EXISTS "idx_execution_step_result_status" ON "test_run_item_execution_step_results" ("status");
CREATE INDEX IF NOT EXISTS "idx_run_items_current_execution" ON "test_run_items" ("current_execution_id");
CREATE INDEX IF NOT EXISTS "idx_artifacts_execution" ON "test_run_artifacts" ("execution_id");

-- Backfill: create Execution #1 from legacy snapshot for every run item
WITH inserted AS (
  INSERT INTO "test_run_item_executions" (
    "run_item_id",
    "attempt_number",
    "status",
    "started_at",
    "completed_at",
    "duration_ms",
    "executed_by",
    "error_message",
    "created_at",
    "updated_at"
  )
  SELECT
    tri."id",
    1,
    tri."status",
    tri."executed_at",
    tri."executed_at",
    tri."duration_ms",
    tri."executed_by",
    tri."error_message",
    tri."created_at",
    CURRENT_TIMESTAMP
  FROM "test_run_items" tri
  WHERE NOT EXISTS (
    SELECT 1
    FROM "test_run_item_executions" trie
    WHERE trie."run_item_id" = tri."id"
      AND trie."attempt_number" = 1
  )
  RETURNING "id", "run_item_id"
)
UPDATE "test_run_items" tri
SET "current_execution_id" = inserted."id"
FROM inserted
WHERE tri."id" = inserted."run_item_id"
  AND tri."current_execution_id" IS NULL;

-- Ensure any remaining items point to latest execution
WITH latest AS (
  SELECT DISTINCT ON ("run_item_id") "id", "run_item_id"
  FROM "test_run_item_executions"
  ORDER BY "run_item_id", "attempt_number" DESC, "created_at" DESC
)
UPDATE "test_run_items" tri
SET "current_execution_id" = latest."id"
FROM latest
WHERE tri."id" = latest."run_item_id"
  AND tri."current_execution_id" IS NULL;

-- Link historical artifacts to execution #1 when possible
UPDATE "test_run_artifacts" tra
SET "execution_id" = trie."id"
FROM "test_run_item_executions" trie
WHERE tra."run_item_id" = trie."run_item_id"
  AND trie."attempt_number" = 1
  AND tra."execution_id" IS NULL;

-- Add FK for current execution pointer after backfill
ALTER TABLE "test_run_items"
ADD CONSTRAINT "fk_run_item_current_execution" FOREIGN KEY ("current_execution_id") REFERENCES "test_run_item_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
