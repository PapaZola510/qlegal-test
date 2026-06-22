CREATE TABLE "legal_template_drafts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "legal_template_drafts" ADD CONSTRAINT "legal_template_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_template_drafts_user_template_uidx" ON "legal_template_drafts" USING btree ("user_id","template_id");
--> statement-breakpoint
CREATE INDEX "legal_template_drafts_user_id_idx" ON "legal_template_drafts" USING btree ("user_id");
