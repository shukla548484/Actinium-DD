-- AlterTable
ALTER TABLE "vessels" ADD COLUMN IF NOT EXISTS "last_intermediate_survey_date" TIMESTAMP(3);
