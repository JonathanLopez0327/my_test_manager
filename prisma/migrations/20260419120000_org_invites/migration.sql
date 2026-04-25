-- CreateEnum
CREATE TYPE "OrgInviteStatus" AS ENUM ('pending', 'consumed', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "org_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "status" "OrgInviteStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "used_by" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_invites_token_key" ON "org_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_invites_org_email_status" ON "org_invites"("organization_id", "email", "status");

-- CreateIndex
CREATE INDEX "org_invites_organization_id_status_idx" ON "org_invites"("organization_id", "status");

-- CreateIndex
CREATE INDEX "org_invites_expires_at_idx" ON "org_invites"("expires_at");

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
