-- AlterTable
ALTER TABLE "test_cases" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
