-- AlterTable
ALTER TABLE "ai_conversations" ADD COLUMN "agent" TEXT NOT NULL DEFAULT 'chat';

-- CreateIndex
CREATE INDEX "idx_ai_conversations_user_project_agent_status_last" ON "ai_conversations"("user_id", "project_id", "agent", "status", "last_message_at");
