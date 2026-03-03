-- Add missing projects.context column tracked outside migrations
ALTER TABLE "projects" ADD COLUMN "context" TEXT;
