ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "kyc_skipped_at" timestamp;
ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "course_completed_at" timestamp;
