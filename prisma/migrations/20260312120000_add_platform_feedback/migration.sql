-- CreateTable
CREATE TABLE "platform_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "email" TEXT,
    "rating" SMALLINT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_platform_feedback_created_at" ON "platform_feedback"("created_at");

-- CreateIndex
CREATE INDEX "idx_platform_feedback_rating" ON "platform_feedback"("rating");
