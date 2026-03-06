-- CreateTable
CREATE TABLE "agent_token_secrets" (
    "api_token_id" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "key_version" TEXT NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_token_secrets_pkey" PRIMARY KEY ("api_token_id")
);

-- AddForeignKey
ALTER TABLE "agent_token_secrets" ADD CONSTRAINT "agent_token_secrets_api_token_id_fkey"
FOREIGN KEY ("api_token_id") REFERENCES "api_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
