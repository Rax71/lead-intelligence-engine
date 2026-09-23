-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "interview_states" ADD COLUMN     "transcript" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "rawItems" JSONB;
