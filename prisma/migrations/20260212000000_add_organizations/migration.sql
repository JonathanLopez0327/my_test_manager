-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member', 'billing');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_is_active_idx" ON "organizations"("is_active");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 1: Add organization_id to projects (nullable initially)
ALTER TABLE "projects" ADD COLUMN "organization_id" UUID;

-- Step 2: Insert Default Organization
INSERT INTO "organizations" ("id", "slug", "name", "is_active", "updated_at")
VALUES (gen_random_uuid(), 'default', 'Default Organization', true, CURRENT_TIMESTAMP);

-- Step 3: Assign all existing users as organization members
-- super_admins get 'owner' role, others get 'member' role
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
SELECT
    o.id,
    u.id,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "user_global_roles" ugr
            WHERE ugr.user_id = u.id AND ugr.role = 'super_admin'
        ) THEN 'owner'::"OrgRole"
        ELSE 'member'::"OrgRole"
    END
FROM "users" u
CROSS JOIN "organizations" o
WHERE o.slug = 'default';

-- Step 4: Set all existing projects' organization_id to the default org
UPDATE "projects"
SET "organization_id" = (SELECT id FROM "organizations" WHERE slug = 'default')
WHERE "organization_id" IS NULL;

-- Step 5: Make organization_id NOT NULL on projects
ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;

-- Step 6: Drop old unique constraint on projects.key, add composite unique
DROP INDEX IF EXISTS "projects_key_key";
CREATE UNIQUE INDEX "projects_organization_id_key_key" ON "projects"("organization_id", "key");

-- Step 7: Add index on projects.organization_id
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- Step 8: Add foreign key from projects to organizations
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Add organization_id to audit_log (nullable)
ALTER TABLE "audit_log" ADD COLUMN "organization_id" UUID;

-- Step 10: Backfill audit_log.organization_id from project relation where possible
UPDATE "audit_log" al
SET "organization_id" = p."organization_id"
FROM "projects" p
WHERE al."entity_type" = 'project' AND al."entity_id" = p."id";

-- Step 11: Add index and foreign key on audit_log.organization_id
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id");

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
