-- AlterTable
ALTER TABLE "agent_token_secrets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ai_conversation_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "ai_conversations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_at" DROP DEFAULT;
