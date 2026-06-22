ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "identity_verified_at" timestamp;
ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "identity_last_expired_at" timestamp;

-- Backfill clock for already-verified ENPs so 14-day expiry applies from a reasonable baseline.
UPDATE "enp_profiles"
SET "identity_verified_at" = COALESCE("updated_at", "created_at", NOW())
WHERE "identity_status" = 'verified' AND "identity_verified_at" IS NULL;
