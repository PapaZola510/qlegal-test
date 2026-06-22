CREATE TABLE "enp_commissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"application_id" text NOT NULL,
	"enp_user_id" text NOT NULL,
	"commissioned_name" text NOT NULL,
	"place_of_work" text NOT NULL,
	"commission_date" timestamp NOT NULL,
	"term_end_date" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"certificate_file_object_id" text,
	"issued_by_user_id" text NOT NULL,
	"am_number" text DEFAULT 'A.M. No. 24-10-14-SC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enp_commission_applications" ADD COLUMN "decision_reason" text;
--> statement-breakpoint
ALTER TABLE "enp_commissions" ADD CONSTRAINT "enp_commissions_application_id_enp_commission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."enp_commission_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enp_commissions" ADD CONSTRAINT "enp_commissions_enp_user_id_users_id_fk" FOREIGN KEY ("enp_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enp_commissions" ADD CONSTRAINT "enp_commissions_certificate_file_object_id_file_objects_id_fk" FOREIGN KEY ("certificate_file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enp_commissions" ADD CONSTRAINT "enp_commissions_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "enp_commissions_application_id_uidx" ON "enp_commissions" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "enp_commissions_enp_user_id_idx" ON "enp_commissions" USING btree ("enp_user_id");
--> statement-breakpoint
CREATE INDEX "enp_commissions_status_idx" ON "enp_commissions" USING btree ("status");
