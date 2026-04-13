-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "keygen_license_id" TEXT,
ADD COLUMN     "keygen_user_id" TEXT,
ALTER COLUMN "beta_expires_at" SET DEFAULT now() + interval '10 days';

-- AlterTable
ALTER TABLE "test_run_item_execution_step_results" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "test_run_item_executions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "test_run_artifacts" RENAME CONSTRAINT "fk_artifact_execution" TO "test_run_artifacts_execution_id_fkey";

-- RenameForeignKey
ALTER TABLE "test_run_item_execution_step_results" RENAME CONSTRAINT "fk_execution_step_execution" TO "test_run_item_execution_step_results_execution_id_fkey";

-- RenameForeignKey
ALTER TABLE "test_run_item_executions" RENAME CONSTRAINT "fk_execution_executed_by" TO "test_run_item_executions_executed_by_fkey";

-- RenameForeignKey
ALTER TABLE "test_run_item_executions" RENAME CONSTRAINT "fk_execution_run_item" TO "test_run_item_executions_run_item_id_fkey";

-- RenameForeignKey
ALTER TABLE "test_run_items" RENAME CONSTRAINT "fk_run_item_current_execution" TO "test_run_items_current_execution_id_fkey";
