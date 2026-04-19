-- Organization quota column
ALTER TABLE "organizations"
  ADD COLUMN "ai_token_limit_monthly" INTEGER NOT NULL DEFAULT 250000;

-- Usage source enum
CREATE TYPE "AiUsageSource" AS ENUM ('chat', 'requirements', 'agent');

-- Aggregated period counters (hot path for quota checks)
CREATE TABLE "ai_usage_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "period_start" TIMESTAMPTZ(6) NOT NULL,
  "period_end" TIMESTAMPTZ(6) NOT NULL,
  "input_tokens" BIGINT NOT NULL DEFAULT 0,
  "output_tokens" BIGINT NOT NULL DEFAULT 0,
  "total_tokens" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ai_usage_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_ai_usage_periods_org_start"
  ON "ai_usage_periods"("organization_id", "period_start");

CREATE INDEX "idx_ai_usage_periods_org_end"
  ON "ai_usage_periods"("organization_id", "period_end");

ALTER TABLE "ai_usage_periods"
  ADD CONSTRAINT "ai_usage_periods_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only event log
CREATE TABLE "ai_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID,
  "conversation_id" UUID,
  "source" "AiUsageSource" NOT NULL,
  "model" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_ai_usage_events_org_created"
  ON "ai_usage_events"("organization_id", "created_at");

CREATE INDEX "idx_ai_usage_events_user_created"
  ON "ai_usage_events"("user_id", "created_at");

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
