ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "government_id_valid_until" timestamp;
ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "government_id_expiry_notice_dismissals" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "government_id_expiry_notice_snooze_until" timestamp;

ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "government_id_valid_until" timestamp;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "government_id_expiry_notice_dismissals" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "government_id_expiry_notice_snooze_until" timestamp;
