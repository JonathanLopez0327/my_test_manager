-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "max_members" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "max_projects" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "max_test_cases" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "max_test_runs" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "beta_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "email" TEXT,
    "used_by" UUID,
    "used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_codes_code_key" ON "beta_codes"("code");

-- CreateIndex
CREATE INDEX "beta_codes_code_idx" ON "beta_codes"("code");

-- CreateIndex
CREATE INDEX "beta_codes_email_idx" ON "beta_codes"("email");

-- AddForeignKey
ALTER TABLE "beta_codes" ADD CONSTRAINT "beta_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beta_codes" ADD CONSTRAINT "beta_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
