ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT true;
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "mfa_required_at" timestamp;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "mfa_verified_at" timestamp;

CREATE TABLE IF NOT EXISTS "email_verification_otps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"resend_available_at" timestamp NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"request_ip" text,
	"purpose" text DEFAULT 'email_verification' NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_otps_user_id_users_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

ALTER TABLE "email_verification_otps" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'email_verification' NOT NULL;
ALTER TABLE "email_verification_otps" ADD COLUMN IF NOT EXISTS "session_id" text;

CREATE INDEX IF NOT EXISTS "email_verification_otps_user_id_idx" ON "email_verification_otps" ("user_id");
CREATE INDEX IF NOT EXISTS "email_verification_otps_email_idx" ON "email_verification_otps" ("email");
CREATE INDEX IF NOT EXISTS "email_verification_otps_expires_at_idx" ON "email_verification_otps" ("expires_at");
CREATE INDEX IF NOT EXISTS "email_verification_otps_purpose_idx" ON "email_verification_otps" ("purpose");
CREATE INDEX IF NOT EXISTS "email_verification_otps_session_id_idx" ON "email_verification_otps" ("session_id");
