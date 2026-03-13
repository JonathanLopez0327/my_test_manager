-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "beta_expires_at" TIMESTAMPTZ(6) DEFAULT now() + interval '10 days';
