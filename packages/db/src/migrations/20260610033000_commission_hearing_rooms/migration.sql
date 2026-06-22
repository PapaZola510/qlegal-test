CREATE TABLE "commission_hearing_rooms" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"application_id" text NOT NULL,
	"ena_user_id" text NOT NULL,
	"applicant_user_id" text NOT NULL,
	"livekit_room_name" text NOT NULL,
	"scheduled_at" timestamp,
	"instructions" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"recording_egress_id" text,
	"recording_file_object_id" text,
	"recording_started_at" timestamp,
	"recording_stopped_at" timestamp,
	"applicant_invite_token_hash" text,
	"applicant_invite_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_hearing_rooms_livekit_room_name_unique" UNIQUE("livekit_room_name")
);
--> statement-breakpoint
CREATE TABLE "commission_hearing_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hearing_room_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_hearing_room_participants" (
	"hearing_room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_hearing_room_participants_pkey" PRIMARY KEY("hearing_room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "commission_hearing_rooms" ADD CONSTRAINT "commission_hearing_rooms_application_id_enp_commission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."enp_commission_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_rooms" ADD CONSTRAINT "commission_hearing_rooms_ena_user_id_users_id_fk" FOREIGN KEY ("ena_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_rooms" ADD CONSTRAINT "commission_hearing_rooms_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_rooms" ADD CONSTRAINT "commission_hearing_rooms_recording_file_object_id_file_objects_id_fk" FOREIGN KEY ("recording_file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_messages" ADD CONSTRAINT "commission_hearing_messages_hearing_room_id_commission_hearing_rooms_id_fk" FOREIGN KEY ("hearing_room_id") REFERENCES "public"."commission_hearing_rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_messages" ADD CONSTRAINT "commission_hearing_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_room_participants" ADD CONSTRAINT "commission_hearing_room_participants_hearing_room_id_commission_hearing_rooms_id_fk" FOREIGN KEY ("hearing_room_id") REFERENCES "public"."commission_hearing_rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_hearing_room_participants" ADD CONSTRAINT "commission_hearing_room_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "commission_hearing_rooms_application_id_uidx" ON "commission_hearing_rooms" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "commission_hearing_rooms_ena_user_id_idx" ON "commission_hearing_rooms" USING btree ("ena_user_id");
--> statement-breakpoint
CREATE INDEX "commission_hearing_rooms_applicant_user_id_idx" ON "commission_hearing_rooms" USING btree ("applicant_user_id");
--> statement-breakpoint
CREATE INDEX "commission_hearing_rooms_status_idx" ON "commission_hearing_rooms" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "commission_hearing_rooms_scheduled_at_idx" ON "commission_hearing_rooms" USING btree ("scheduled_at");
--> statement-breakpoint
CREATE INDEX "commission_hearing_messages_room_created_at_idx" ON "commission_hearing_messages" USING btree ("hearing_room_id","created_at");
--> statement-breakpoint
CREATE INDEX "commission_hearing_messages_sender_user_id_idx" ON "commission_hearing_messages" USING btree ("sender_user_id");
--> statement-breakpoint
CREATE INDEX "commission_hearing_room_participants_user_id_idx" ON "commission_hearing_room_participants" USING btree ("user_id");
