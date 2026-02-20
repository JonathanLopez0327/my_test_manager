-- CreateEnum
CREATE TYPE "TestCaseStyle" AS ENUM ('step_by_step', 'gherkin', 'data_driven', 'api');

-- AlterTable
ALTER TABLE "test_cases" ADD COLUMN     "style" "TestCaseStyle" NOT NULL DEFAULT 'step_by_step';

-- CreateIndex
CREATE INDEX "idx_test_cases_style" ON "test_cases"("style");
