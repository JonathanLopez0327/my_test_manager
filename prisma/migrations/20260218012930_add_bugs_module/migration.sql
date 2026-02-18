-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened');

-- CreateEnum
CREATE TYPE "BugType" AS ENUM ('bug', 'enhancement', 'task');

-- CreateTable
CREATE TABLE "bugs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "BugSeverity" NOT NULL DEFAULT 'medium',
    "priority" SMALLINT NOT NULL DEFAULT 3,
    "status" "BugStatus" NOT NULL DEFAULT 'open',
    "type" "BugType" NOT NULL DEFAULT 'bug',
    "assigned_to" UUID,
    "reporter" UUID,
    "test_run_item_id" UUID,
    "test_case_id" UUID,
    "reproduction_steps" TEXT,
    "expected_result" TEXT,
    "actual_result" TEXT,
    "environment" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bug_id" UUID NOT NULL,
    "author_id" UUID,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bug_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bugs_project" ON "bugs"("project_id");

-- CreateIndex
CREATE INDEX "idx_bugs_status" ON "bugs"("status");

-- CreateIndex
CREATE INDEX "idx_bugs_severity" ON "bugs"("severity");

-- CreateIndex
CREATE INDEX "idx_bugs_assigned_to" ON "bugs"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_bugs_project_status" ON "bugs"("project_id", "status");

-- CreateIndex
CREATE INDEX "idx_bug_comments_bug" ON "bug_comments"("bug_id");

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_reporter_fkey" FOREIGN KEY ("reporter") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_test_run_item_id_fkey" FOREIGN KEY ("test_run_item_id") REFERENCES "test_run_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
