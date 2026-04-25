-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "max_artifact_bytes" BIGINT NOT NULL DEFAULT 524288000;
