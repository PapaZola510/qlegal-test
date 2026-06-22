ALTER TABLE "appointments" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
CREATE INDEX "appointments_kind_idx" ON "appointments" ("kind");--> statement-breakpoint
CREATE TABLE "quicksign_projects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"enp_user_id" text NOT NULL,
	"document_file_object_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"doconchain_project_uuid" text,
	"plot_completed_at" timestamp,
	"appointment_id" text,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quicksign_projects_enp_user_id_users_id_fk" FOREIGN KEY ("enp_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "quicksign_projects_document_file_object_id_file_objects_id_fk" FOREIGN KEY ("document_file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "quicksign_projects_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "quicksign_projects_appointment_id_unique" UNIQUE("appointment_id")
);--> statement-breakpoint
CREATE INDEX "quicksign_projects_enp_user_id_idx" ON "quicksign_projects" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "quicksign_projects_doconchain_uuid_idx" ON "quicksign_projects" ("doconchain_project_uuid");--> statement-breakpoint
CREATE TABLE "quicksign_signers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"project_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"sequence_order" integer DEFAULT 1 NOT NULL,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quicksign_signers_project_id_quicksign_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."quicksign_projects"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "quicksign_signers_project_id_idx" ON "quicksign_signers" ("project_id");--> statement-breakpoint
CREATE INDEX "quicksign_signers_email_idx" ON "quicksign_signers" ("email");
