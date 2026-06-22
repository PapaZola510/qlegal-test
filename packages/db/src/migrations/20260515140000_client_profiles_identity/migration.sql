-- Client KYC parity: identity columns on client_profiles (HyperVerge + expiry).
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "identity_status" text NOT NULL DEFAULT 'unverified';
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "identity_verified_at" timestamp;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "identity_last_expired_at" timestamp;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "latest_hyperverge_txn_id" text;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "kyc_skipped_at" timestamp;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "retake_count" integer NOT NULL DEFAULT 0;

DO $$
BEGIN
	ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_latest_hyperverge_txn_id_hyperverge_transactions_id_fk" FOREIGN KEY ("latest_hyperverge_txn_id") REFERENCES "public"."hyperverge_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- Existing clients: treat as opted out of the new onboarding gate so they stay on "complete".
UPDATE "client_profiles"
SET "kyc_skipped_at" = COALESCE("kyc_skipped_at", "updated_at")
WHERE "kyc_skipped_at" IS NULL;
