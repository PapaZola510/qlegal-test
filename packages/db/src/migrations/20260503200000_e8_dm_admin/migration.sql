ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_role" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE TABLE "dm_conversations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"conv_key" text NOT NULL,
	"low_user_id" text NOT NULL,
	"high_user_id" text NOT NULL,
	"last_message_preview" text,
	"last_message_at" timestamp,
	"low_user_last_read_at" timestamp,
	"high_user_last_read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dm_conversations_conv_key_uidx" UNIQUE("conv_key"),
	CONSTRAINT "dm_conversations_low_user_id_users_id_fk" FOREIGN KEY ("low_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "dm_conversations_high_user_id_users_id_fk" FOREIGN KEY ("high_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "dm_conversations_low_user_id_idx" ON "dm_conversations" ("low_user_id");--> statement-breakpoint
CREATE INDEX "dm_conversations_high_user_id_idx" ON "dm_conversations" ("high_user_id");--> statement-breakpoint
CREATE TABLE "dm_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dm_messages_conversation_id_dm_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."dm_conversations"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "dm_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "dm_messages_conversation_id_created_at_idx" ON "dm_messages" ("conversation_id", "created_at");
