ALTER TABLE "enp_commission_applications" ADD COLUMN "summary_hearing_room_id" text;
--> statement-breakpoint
ALTER TABLE "enp_commission_applications" ADD CONSTRAINT "enp_commission_applications_summary_hearing_room_id_commission_hearing_rooms_id_fk" FOREIGN KEY ("summary_hearing_room_id") REFERENCES "public"."commission_hearing_rooms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "enp_commission_applications_summary_hearing_room_id_idx" ON "enp_commission_applications" USING btree ("summary_hearing_room_id");
