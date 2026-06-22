ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "sc_commission_status_synced_at" timestamp;
ALTER TABLE "enp_profiles" ADD COLUMN IF NOT EXISTS "sc_commission_status_admin_override" boolean NOT NULL DEFAULT false;
