-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('super_admin', 'support', 'auditor');

-- CreateTable
CREATE TABLE "user_global_roles" (
    "user_id" UUID NOT NULL,
    "role" "GlobalRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_global_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateIndex
CREATE INDEX "user_global_roles_role_idx" ON "user_global_roles"("role");

-- CreateIndex
CREATE INDEX "idx_projects_active" ON "projects"("is_active");

-- CreateIndex
CREATE INDEX "idx_runs_created_at" ON "test_runs"("created_at");

-- CreateIndex
CREATE INDEX "idx_runs_project_created" ON "test_runs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_user_sessions_user" ON "user_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "user_global_roles" ADD CONSTRAINT "user_global_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
