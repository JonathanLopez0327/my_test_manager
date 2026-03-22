-- CreateTable
CREATE TABLE "bug_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bug_id" UUID NOT NULL,
    "type" "ArtifactType" NOT NULL DEFAULT 'other',
    "name" TEXT,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bug_attachments_bug" ON "bug_attachments"("bug_id");

-- CreateIndex
CREATE INDEX "idx_bug_attachments_created_at" ON "bug_attachments"("created_at");

-- AddForeignKey
ALTER TABLE "bug_attachments" ADD CONSTRAINT "bug_attachments_bug_id_fkey" FOREIGN KEY ("bug_id") REFERENCES "bugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
