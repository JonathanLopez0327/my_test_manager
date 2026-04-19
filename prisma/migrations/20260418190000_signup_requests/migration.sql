-- CreateEnum
CREATE TYPE "SignupRequestProvider" AS ENUM ('credentials', 'google');

-- CreateEnum
CREATE TYPE "SignupRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "signup_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "organization_name" TEXT NOT NULL,
    "organization_slug" TEXT,
    "provider" "SignupRequestProvider" NOT NULL,
    "status" "SignupRequestStatus" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "signup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signup_requests_email_key" ON "signup_requests"("email");

-- CreateIndex
CREATE INDEX "signup_requests_status_created_at_idx" ON "signup_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "signup_requests" ADD CONSTRAINT "signup_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
