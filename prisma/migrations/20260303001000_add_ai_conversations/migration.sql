-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "thread_id" TEXT,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMPTZ(6),
    "last_message_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_conversations_org" ON "ai_conversations"("organization_id");

-- CreateIndex
CREATE INDEX "idx_ai_conversations_project" ON "ai_conversations"("project_id");

-- CreateIndex
CREATE INDEX "idx_ai_conversations_user_project_status_last" ON "ai_conversations"("user_id", "project_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "idx_ai_messages_conversation_created" ON "ai_conversation_messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
