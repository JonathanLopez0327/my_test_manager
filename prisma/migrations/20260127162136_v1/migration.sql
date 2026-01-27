-- CreateEnum
CREATE TYPE "TestPlanStatus" AS ENUM ('draft', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('draft', 'ready', 'deprecated');

-- CreateEnum
CREATE TYPE "TestRunType" AS ENUM ('manual', 'automated');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('queued', 'running', 'completed', 'canceled', 'failed');

-- CreateEnum
CREATE TYPE "TestResultStatus" AS ENUM ('passed', 'failed', 'skipped', 'blocked', 'not_run');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('screenshot', 'video', 'log', 'report', 'link', 'other');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('admin', 'editor', 'viewer');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "test_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TestPlanStatus" NOT NULL DEFAULT 'draft',
    "starts_on" DATE,
    "ends_on" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_plan_id" UUID NOT NULL,
    "parent_suite_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "suite_id" UUID NOT NULL,
    "external_key" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preconditions" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "status" "TestCaseStatus" NOT NULL DEFAULT 'draft',
    "is_automated" BOOLEAN NOT NULL DEFAULT false,
    "automation_type" TEXT,
    "automation_ref" TEXT,
    "automation_owner" UUID,
    "priority" SMALLINT NOT NULL DEFAULT 3,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "test_plan_id" UUID,
    "suite_id" UUID,
    "run_type" "TestRunType" NOT NULL,
    "status" "TestRunStatus" NOT NULL DEFAULT 'queued',
    "name" TEXT,
    "triggered_by" UUID,
    "environment" TEXT,
    "build_number" TEXT,
    "branch" TEXT,
    "commit_sha" TEXT,
    "ci_provider" TEXT,
    "ci_run_url" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "status" "TestResultStatus" NOT NULL DEFAULT 'not_run',
    "duration_ms" INTEGER,
    "executed_by" UUID,
    "executed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "stacktrace" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID,
    "run_item_id" UUID,
    "type" "ArtifactType" NOT NULL DEFAULT 'other',
    "name" TEXT,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_metrics" (
    "run_id" UUID NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "blocked" INTEGER NOT NULL,
    "not_run" INTEGER NOT NULL,
    "pass_rate" DECIMAL(5,2) NOT NULL,
    "duration_ms" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_metrics_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "projects_key_key" ON "projects"("key");

-- CreateIndex
CREATE INDEX "idx_project_members_user" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "idx_test_plans_project" ON "test_plans"("project_id");

-- CreateIndex
CREATE INDEX "idx_test_plans_status" ON "test_plans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_plans_project_id_name_key" ON "test_plans"("project_id", "name");

-- CreateIndex
CREATE INDEX "idx_suites_plan" ON "test_suites"("test_plan_id");

-- CreateIndex
CREATE INDEX "idx_suites_parent" ON "test_suites"("parent_suite_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_suites_test_plan_id_parent_suite_id_name_key" ON "test_suites"("test_plan_id", "parent_suite_id", "name");

-- CreateIndex
CREATE INDEX "idx_test_cases_suite" ON "test_cases"("suite_id");

-- CreateIndex
CREATE INDEX "idx_test_cases_status" ON "test_cases"("status");

-- CreateIndex
CREATE INDEX "idx_test_cases_automated" ON "test_cases"("is_automated");

-- CreateIndex
CREATE INDEX "idx_test_cases_steps_gin" ON "test_cases" USING GIN ("steps");

-- CreateIndex
CREATE INDEX "idx_runs_project" ON "test_runs"("project_id");

-- CreateIndex
CREATE INDEX "idx_runs_plan" ON "test_runs"("test_plan_id");

-- CreateIndex
CREATE INDEX "idx_runs_status" ON "test_runs"("status");

-- CreateIndex
CREATE INDEX "idx_runs_type" ON "test_runs"("run_type");

-- CreateIndex
CREATE INDEX "idx_run_items_run" ON "test_run_items"("run_id");

-- CreateIndex
CREATE INDEX "idx_run_items_case" ON "test_run_items"("test_case_id");

-- CreateIndex
CREATE INDEX "idx_run_items_status" ON "test_run_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_run_items_run_id_test_case_id_key" ON "test_run_items"("run_id", "test_case_id");

-- CreateIndex
CREATE INDEX "idx_artifacts_run" ON "test_run_artifacts"("run_id");

-- CreateIndex
CREATE INDEX "idx_artifacts_run_item" ON "test_run_artifacts"("run_item_id");

-- CreateIndex
CREATE INDEX "idx_artifacts_meta_gin" ON "test_run_artifacts" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_log"("actor_user_id");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "test_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_parent_suite_id_fkey" FOREIGN KEY ("parent_suite_id") REFERENCES "test_suites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_automation_owner_fkey" FOREIGN KEY ("automation_owner") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "test_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_items" ADD CONSTRAINT "test_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_items" ADD CONSTRAINT "test_run_items_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_items" ADD CONSTRAINT "test_run_items_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_artifacts" ADD CONSTRAINT "test_run_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_artifacts" ADD CONSTRAINT "test_run_artifacts_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "test_run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_metrics" ADD CONSTRAINT "test_run_metrics_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
