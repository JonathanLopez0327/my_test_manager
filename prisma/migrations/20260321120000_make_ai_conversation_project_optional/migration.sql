-- AlterTable: make project_id nullable on ai_conversations
ALTER TABLE "ai_conversations" ALTER COLUMN "project_id" DROP NOT NULL;

-- DropForeignKey (cascade) and recreate with SetNull
ALTER TABLE "ai_conversations" DROP CONSTRAINT IF EXISTS "ai_conversations_project_id_fkey";
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
