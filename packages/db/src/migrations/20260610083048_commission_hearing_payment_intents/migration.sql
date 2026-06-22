ALTER TABLE "payment_intents" ADD COLUMN "hearing_room_id" text;
--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_hearing_room_id_commission_hearing_rooms_id_fk" FOREIGN KEY ("hearing_room_id") REFERENCES "public"."commission_hearing_rooms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payment_intents_hearing_room_id_idx" ON "payment_intents" USING btree ("hearing_room_id");
