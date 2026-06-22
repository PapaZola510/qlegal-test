CREATE TABLE "exam_attempt_answers" (
	"attempt_id" text,
	"question_id" text,
	"choice_key" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_attempt_answers_pkey" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"exam_version_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"resume_token_hash" text,
	"resume_used" boolean DEFAULT false NOT NULL,
	"sections_completed" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"passed" boolean,
	"payment_intent_id" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_question_revisions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"question_id" text NOT NULL,
	"prompt_text" text NOT NULL,
	"choices_json" jsonb NOT NULL,
	"correct_choice_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"exam_version_id" text NOT NULL,
	"legacy_stable_id" text NOT NULL,
	"section_index" integer NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_versions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"passing_score_pct" integer DEFAULT 70 NOT NULL,
	"section_count" integer DEFAULT 5 NOT NULL,
	"questions_per_section" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text NOT NULL,
	"purpose" text NOT NULL,
	"provider" text DEFAULT 'stub' NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"paid_at" timestamp,
	"paid_via_admin_override" boolean DEFAULT false NOT NULL,
	"admin_actor_id" text,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "exam_attempt_answers_attempt_idx" ON "exam_attempt_answers" ("attempt_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_user_id_idx" ON "exam_attempts" ("user_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_version_idx" ON "exam_attempts" ("exam_version_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_status_idx" ON "exam_attempts" ("status");--> statement-breakpoint
CREATE INDEX "exam_question_revisions_question_idx" ON "exam_question_revisions" ("question_id");--> statement-breakpoint
CREATE INDEX "exam_questions_version_idx" ON "exam_questions" ("exam_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_questions_version_stable_uidx" ON "exam_questions" ("exam_version_id","legacy_stable_id");--> statement-breakpoint
CREATE INDEX "exam_versions_is_active_idx" ON "exam_versions" ("is_active");--> statement-breakpoint
CREATE INDEX "payment_intents_user_id_idx" ON "payment_intents" ("user_id");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" ("status");--> statement-breakpoint
CREATE INDEX "payment_intents_purpose_idx" ON "payment_intents" ("purpose");--> statement-breakpoint
ALTER TABLE "exam_attempt_answers" ADD CONSTRAINT "exam_attempt_answers_attempt_id_exam_attempts_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exam_attempt_answers" ADD CONSTRAINT "exam_attempt_answers_question_id_exam_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_version_id_exam_versions_id_fkey" FOREIGN KEY ("exam_version_id") REFERENCES "exam_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_payment_intent_id_payment_intents_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "exam_question_revisions" ADD CONSTRAINT "exam_question_revisions_question_id_exam_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_version_id_exam_versions_id_fkey" FOREIGN KEY ("exam_version_id") REFERENCES "exam_versions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_admin_actor_id_users_id_fkey" FOREIGN KEY ("admin_actor_id") REFERENCES "users"("id") ON DELETE SET NULL;