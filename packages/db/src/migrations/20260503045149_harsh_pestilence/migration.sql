CREATE TABLE "appointment_documents" (
	"appointment_id" text,
	"file_object_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_documents_pkey" PRIMARY KEY("appointment_id","file_object_id")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_user_id" text NOT NULL,
	"enp_user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"location" text,
	"meeting_url" text,
	"notes" text,
	"notarization_type" text NOT NULL,
	"session_mode" text NOT NULL,
	"decline_reason" text,
	"confirmed_at" timestamp,
	"can_start" boolean DEFAULT false NOT NULL,
	"can_rejoin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "directory_base_fee_php" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "directory_specializations" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "directory_offered_modes" text[] DEFAULT ARRAY['remote','in_person']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "booking_invite_token_hash" text;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "booking_invite_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD CONSTRAINT "enp_profiles_booking_invite_token_hash_key" UNIQUE("booking_invite_token_hash");--> statement-breakpoint
CREATE INDEX "appointment_documents_file_object_id_idx" ON "appointment_documents" ("file_object_id");--> statement-breakpoint
CREATE INDEX "appointments_client_user_id_idx" ON "appointments" ("client_user_id");--> statement-breakpoint
CREATE INDEX "appointments_enp_user_id_idx" ON "appointments" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" ("status");--> statement-breakpoint
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments" ("scheduled_at");--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD CONSTRAINT "appointment_documents_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD CONSTRAINT "appointment_documents_file_object_id_file_objects_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_user_id_users_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_enp_user_id_users_id_fkey" FOREIGN KEY ("enp_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;