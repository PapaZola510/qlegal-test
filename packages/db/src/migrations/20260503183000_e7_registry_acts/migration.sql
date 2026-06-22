CREATE TABLE "registry_acts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"enp_user_id" text NOT NULL,
	"appointment_id" text,
	"act_number" text NOT NULL,
	"act_type" text NOT NULL,
	"title" text NOT NULL,
	"parties" jsonb NOT NULL,
	"executed_at" timestamp NOT NULL,
	"document_url" text,
	"book_no" text,
	"page_no" text,
	"fee_php" integer,
	"description" text,
	"sc_status" text DEFAULT 'draft' NOT NULL,
	"sc_submitted_at" timestamp,
	"sc_synced_at" timestamp,
	"sc_rejection_reason" text,
	"sc_external_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_acts_enp_user_id_users_id_fk" FOREIGN KEY ("enp_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "registry_acts_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "registry_acts_enp_user_id_idx" ON "registry_acts" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "registry_acts_appointment_id_idx" ON "registry_acts" ("appointment_id");--> statement-breakpoint
CREATE INDEX "registry_acts_sc_status_idx" ON "registry_acts" ("sc_status");
