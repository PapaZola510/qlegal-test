CREATE TABLE "commission_hearing_oppositions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"application_id" text NOT NULL,
	"hearing_room_id" text,
	"oppositor_name" text NOT NULL,
	"oppositor_email" text NOT NULL,
	"oppositor_user_id" text,
	"grounds" text NOT NULL,
	"verified_document_file_object_id" text NOT NULL,
	"representative_document_file_object_id" text,
	"status" text DEFAULT 'filed' NOT NULL,
	"access_token_hash" text,
	"access_expires_at" timestamp,
	"non_appearance_excused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "commission_hearing_oppositions_application_id_idx" ON "commission_hearing_oppositions" ("application_id");
--> statement-breakpoint
CREATE INDEX "commission_hearing_oppositions_hearing_room_id_idx" ON "commission_hearing_oppositions" ("hearing_room_id");
--> statement-breakpoint
CREATE INDEX "commission_hearing_oppositions_status_idx" ON "commission_hearing_oppositions" ("status");
--> statement-breakpoint
CREATE INDEX "commission_hearing_oppositions_oppositor_email_idx" ON "commission_hearing_oppositions" ("oppositor_email");
--> statement-breakpoint
ALTER TABLE "commission_hearing_oppositions" ADD CONSTRAINT "commission_hearing_oppositions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "enp_commission_applications"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "commission_hearing_oppositions" ADD CONSTRAINT "commission_hearing_oppositions_hearing_room_id_fkey" FOREIGN KEY ("hearing_room_id") REFERENCES "commission_hearing_rooms"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "commission_hearing_oppositions" ADD CONSTRAINT "commission_hearing_oppositions_oppositor_user_id_fkey" FOREIGN KEY ("oppositor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "commission_hearing_oppositions" ADD CONSTRAINT "commission_hearing_oppositions_verified_document_file_object_id_fkey" FOREIGN KEY ("verified_document_file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "commission_hearing_oppositions" ADD CONSTRAINT "commission_hearing_oppositions_representative_document_file_object_id_fkey" FOREIGN KEY ("representative_document_file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;
