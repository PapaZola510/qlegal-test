ALTER TABLE "file_objects" ALTER COLUMN "purpose" SET DATA TYPE text;

CREATE TABLE "compliance_access_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"context" jsonb,
	"prev_hash" text,
	"row_hash" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_access_log_row_hash_unique" UNIQUE("row_hash")
);

CREATE TABLE "compliance_exports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_user_id" text NOT NULL,
	"dataset" text NOT NULL,
	"format" text NOT NULL,
	"filter" jsonb,
	"row_count" integer DEFAULT 0 NOT NULL,
	"file_object_id" text,
	"export_sha256" text NOT NULL,
	"chain_head_hash" text,
	"manifest_signature" text,
	"manifest" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "compliance_access_log"
	ADD CONSTRAINT "compliance_access_log_actor_user_id_users_id_fk"
	FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "compliance_exports"
	ADD CONSTRAINT "compliance_exports_actor_user_id_users_id_fk"
	FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "compliance_exports"
	ADD CONSTRAINT "compliance_exports_file_object_id_file_objects_id_fk"
	FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "compliance_access_log_actor_idx" ON "compliance_access_log" USING btree ("actor_user_id");
CREATE INDEX "compliance_access_log_action_idx" ON "compliance_access_log" USING btree ("action");
CREATE INDEX "compliance_access_log_occurred_at_idx" ON "compliance_access_log" USING btree ("occurred_at");
CREATE INDEX "compliance_exports_actor_idx" ON "compliance_exports" USING btree ("actor_user_id");
CREATE INDEX "compliance_exports_dataset_idx" ON "compliance_exports" USING btree ("dataset");
