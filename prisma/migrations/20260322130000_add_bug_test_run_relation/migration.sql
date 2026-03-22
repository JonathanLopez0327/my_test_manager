-- AlterTable
ALTER TABLE "bugs" ADD COLUMN "test_run_id" UUID;

-- CreateIndex
CREATE INDEX "idx_bugs_test_run" ON "bugs"("test_run_id");

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
