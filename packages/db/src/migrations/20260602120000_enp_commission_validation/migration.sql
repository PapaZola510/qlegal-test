ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "commission_expiry_notice_dismissals" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "sc_commission_status" text;
