CREATE TABLE "accounts" (
	"id" text,
	"account_id" text,
	"provider_id" text,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_pkey" PRIMARY KEY("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_id" text,
	"sub_org_id" text,
	"event_type" text NOT NULL,
	"target_table" text,
	"target_id" text,
	"payload" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"user_id" text PRIMARY KEY,
	"sub_org_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone_e164" text,
	"organization" text,
	"position" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enp_profiles" (
	"user_id" text PRIMARY KEY,
	"sub_org_id" text NOT NULL,
	"prefix" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"suffix" text,
	"phone_e164" text,
	"roll_no" text,
	"npn_commission_no" text,
	"commission_valid_until" timestamp,
	"ptr_no" text,
	"ptr_location" text,
	"ptr_date" timestamp,
	"ibp_no" text,
	"ibp_date" timestamp,
	"mcle_no" text,
	"mcle_period" text,
	"mcle_date" timestamp,
	"notary_address" text,
	"home_street" text,
	"barangay" text,
	"city_province" text,
	"identity_status" text DEFAULT 'pending' NOT NULL,
	"latest_hyperverge_txn_id" text,
	"certificate_status" text DEFAULT 'none' NOT NULL,
	"certificate_id" text UNIQUE,
	"retake_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_objects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"sub_org_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"bucket" text NOT NULL,
	"s3_key" text NOT NULL UNIQUE,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"purpose" text NOT NULL,
	"virus_scan_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hyperverge_transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"hv_transaction_id" text UNIQUE,
	"status" text NOT NULL,
	"sdk_callback_at" timestamp,
	"webhook_received_at" timestamp,
	"raw_response_json" jsonb,
	"selfie_file_id" text,
	"id_image_file_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_orgs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"concern" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"author_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text,
	"identifier" text,
	"value" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "verifications_pkey" PRIMARY KEY("identifier","value")
);
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_sub_org_id_idx" ON "audit_events" ("sub_org_id");--> statement-breakpoint
CREATE INDEX "audit_events_event_type_idx" ON "audit_events" ("event_type");--> statement-breakpoint
CREATE INDEX "file_objects_sub_org_id_idx" ON "file_objects" ("sub_org_id");--> statement-breakpoint
CREATE INDEX "file_objects_owner_user_id_idx" ON "file_objects" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "hyperverge_transactions_user_id_idx" ON "hyperverge_transactions" ("user_id");--> statement-breakpoint
CREATE INDEX "sub_orgs_owner_id_idx" ON "sub_orgs" ("owner_id");--> statement-breakpoint
CREATE INDEX "sub_orgs_kind_idx" ON "sub_orgs" ("kind");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_sub_org_id_sub_orgs_id_fkey" FOREIGN KEY ("sub_org_id") REFERENCES "sub_orgs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_sub_org_id_sub_orgs_id_fkey" FOREIGN KEY ("sub_org_id") REFERENCES "sub_orgs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD CONSTRAINT "enp_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD CONSTRAINT "enp_profiles_sub_org_id_sub_orgs_id_fkey" FOREIGN KEY ("sub_org_id") REFERENCES "sub_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD CONSTRAINT "enp_profiles_oBuxBTlqwRvz_fkey" FOREIGN KEY ("latest_hyperverge_txn_id") REFERENCES "hyperverge_transactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_sub_org_id_sub_orgs_id_fkey" FOREIGN KEY ("sub_org_id") REFERENCES "sub_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_owner_user_id_users_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hyperverge_transactions" ADD CONSTRAINT "hyperverge_transactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hyperverge_transactions" ADD CONSTRAINT "hyperverge_transactions_selfie_file_id_file_objects_id_fkey" FOREIGN KEY ("selfie_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "hyperverge_transactions" ADD CONSTRAINT "hyperverge_transactions_id_image_file_id_file_objects_id_fkey" FOREIGN KEY ("id_image_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sub_orgs" ADD CONSTRAINT "sub_orgs_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE;