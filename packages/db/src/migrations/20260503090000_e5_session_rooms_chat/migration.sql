CREATE TABLE "session_rooms" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"appointment_id" text NOT NULL,
	"livekit_room_name" text NOT NULL,
	"guest_invite_token_hash" text,
	"guest_invite_expires_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_rooms_appointment_id_uidx" UNIQUE("appointment_id"),
	CONSTRAINT "session_rooms_livekit_room_name_unique" UNIQUE("livekit_room_name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"session_room_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_room_guests" (
	"session_room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_room_guests_pkey" PRIMARY KEY("session_room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "session_rooms" ADD CONSTRAINT "session_rooms_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_room_id_session_rooms_id_fk" FOREIGN KEY ("session_room_id") REFERENCES "public"."session_rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_room_guests" ADD CONSTRAINT "session_room_guests_session_room_id_session_rooms_id_fk" FOREIGN KEY ("session_room_id") REFERENCES "public"."session_rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_room_guests" ADD CONSTRAINT "session_room_guests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "session_rooms_livekit_room_name_idx" ON "session_rooms" USING btree ("livekit_room_name");
--> statement-breakpoint
CREATE INDEX "messages_session_room_id_created_at_idx" ON "messages" USING btree ("session_room_id","created_at");
--> statement-breakpoint
CREATE INDEX "messages_sender_user_id_idx" ON "messages" USING btree ("sender_user_id");
--> statement-breakpoint
CREATE INDEX "session_room_guests_user_id_idx" ON "session_room_guests" USING btree ("user_id");
