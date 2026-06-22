	CREATE TABLE "appointment_document_types" (
	"appointment_id" text,
	"enp_document_type_id" text,
	"price_php_snapshot" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_document_types_pkey" PRIMARY KEY("appointment_id","enp_document_type_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_access_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_id" text NOT NULL,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"context" jsonb,
	"prev_hash" text,
	"row_hash" text NOT NULL UNIQUE,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_exports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_id" text NOT NULL,
	"dataset" text NOT NULL,
	"format" text NOT NULL,
	"filter" jsonb,
	"row_count" integer DEFAULT 0 NOT NULL,
	"file_object_id" text,
	"export_sha256" text NOT NULL,
	"chain_head_hash" text,
	"manifest_signature" text,
	"manifest" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_conversations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"conv_key" text NOT NULL UNIQUE,
	"low_user_id" text NOT NULL,
	"high_user_id" text NOT NULL,
	"last_message_preview" text,
	"last_message_at" timestamp,
	"low_user_last_read_at" timestamp,
	"high_user_last_read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"conversation_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_review_request_document_types" (
	"review_request_id" text,
	"enp_document_type_id" text,
	"price_php_snapshot" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_review_request_document_types_pkey" PRIMARY KEY("review_request_id","enp_document_type_id")
);
--> statement-breakpoint
CREATE TABLE "document_review_request_files" (
	"review_request_id" text,
	"file_object_id" text,
	"display_name" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"quicksign_project_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_review_request_files_pkey" PRIMARY KEY("review_request_id","file_object_id")
);
--> statement-breakpoint
CREATE TABLE "document_review_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_user_id" text NOT NULL,
	"enp_user_id" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"notarization_type" text,
	"session_mode" text DEFAULT 'remote' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"proposed_slots" jsonb DEFAULT '[]' NOT NULL,
	"rejection_reason" text,
	"approved_appointment_id" text,
	"approved_path" text,
	"active_quicksign_project_id" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_otps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"resend_available_at" timestamp NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"request_ip" text,
	"purpose" text DEFAULT 'email_verification' NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enb_access_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"enp_user_id" text NOT NULL,
	"registry_act_id" text,
	"book_no" text,
	"request_type" text NOT NULL,
	"certified_true_copy" boolean DEFAULT false NOT NULL,
	"requester_user_id" text,
	"appointment_id" text,
	"document_file_object_id" text,
	"requester_name" text NOT NULL,
	"requester_address" text NOT NULL,
	"lawful_purpose" text NOT NULL,
	"requester_signature_image_data" text,
	"requester_signature_file_object_id" text,
	"identity_evidence_file_object_id" text,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"refusal_reason" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enp_commission_application_documents" (
	"application_id" text,
	"requirement_key" text,
	"file_object_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enp_commission_application_documents_pkey" PRIMARY KEY("application_id","requirement_key")
);
--> statement-breakpoint
CREATE TABLE "enp_commission_applications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"applicant_user_id" text NOT NULL,
	"sub_org_id" text NOT NULL,
	"citizenship" text NOT NULL,
	"ulas_compliance_number" text,
	"qualifications_statement" text NOT NULL,
	"undertaking_rules" boolean NOT NULL,
	"undertaking_data_sharing" boolean NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"summary_hearing_scheduled_at" timestamp,
	"summary_hearing_appointment_id" text,
	"summary_hearing_meeting_url" text,
	"summary_hearing_instructions" text,
	"summary_hearing_scheduled_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enp_document_types" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"enp_user_id" text NOT NULL,
	"name" text NOT NULL,
	"price_php" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ien_notarial_attestations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"quicksign_project_id" text NOT NULL,
	"appointment_id" text,
	"document_file_object_id" text NOT NULL,
	"role" text NOT NULL,
	"user_id" text NOT NULL,
	"signer_email" text NOT NULL,
	"signer_name" text DEFAULT '' NOT NULL,
	"acknowledgment_text" text DEFAULT '' NOT NULL,
	"confirmed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liveness_validations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"appointment_id" text NOT NULL,
	"transaction_id" text NOT NULL UNIQUE,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"decision_json" jsonb,
	"raw_result_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_windows" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"message" text NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"created_by_user_id" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_enb_signature_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"appointment_id" text NOT NULL,
	"registry_act_id" text NOT NULL,
	"signer_user_id" text NOT NULL,
	"signer_role" text DEFAULT 'principal' NOT NULL,
	"signer_name" text NOT NULL,
	"entry_number" text NOT NULL,
	"document_title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signature_acknowledgment" text,
	"signature_image_data" text,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_signature_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"appointment_id" text NOT NULL,
	"document_file_object_id" text NOT NULL,
	"signer_user_id" text NOT NULL,
	"signer_role" text DEFAULT 'principal' NOT NULL,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quicksign_projects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"enp_user_id" text NOT NULL,
	"document_file_object_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"doconchain_project_uuid" text,
	"notarized_file_object_id" text,
	"plot_completed_at" timestamp,
	"appointment_id" text UNIQUE,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"notarized_pdf_emailed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quicksign_signers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"sequence_order" integer DEFAULT 1 NOT NULL,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_acts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"enp_user_id" text NOT NULL,
	"appointment_id" text,
	"act_number" text NOT NULL,
	"act_type" text NOT NULL,
	"title" text NOT NULL,
	"parties" jsonb NOT NULL,
	"executed_at" timestamp NOT NULL,
	"document_url" text,
	"book_no" text,
	"page_no" text,
	"fee_php" integer,
	"description" text,
	"sc_status" text DEFAULT 'draft' NOT NULL,
	"sc_submitted_at" timestamp,
	"sc_synced_at" timestamp,
	"sc_rejection_reason" text,
	"sc_external_ref" text,
	"entry_number" text,
	"completion_status" text DEFAULT 'completed' NOT NULL,
	"incomplete_reason" text,
	"incomplete_circumstances" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_protest_proceedings" (
	"registry_act_id" text PRIMARY KEY,
	"demand_by" text,
	"demand_when" text,
	"demand_where" text,
	"sum_demanded" text,
	"presented" boolean,
	"presentation_notes" text,
	"notices" jsonb DEFAULT '[]' NOT NULL,
	"other_facts" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_room_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_room_guests" (
	"session_room_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_room_guests_pkey" PRIMARY KEY("session_room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "session_rooms" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"appointment_id" text NOT NULL,
	"livekit_room_name" text NOT NULL UNIQUE,
	"guest_invite_token_hash" text,
	"guest_invite_expires_at" timestamp,
	"guest_invite_intended_role" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD COLUMN "document_type" text;--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD COLUMN "enp_document_type_id" text;--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD COLUMN "fee_php" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "enb_signing_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "enb_signing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "enb_signing_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "identity_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "identity_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "identity_last_expired_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "government_id_valid_until" timestamp;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "government_id_expiry_notice_dismissals" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "government_id_expiry_notice_snooze_until" timestamp;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "latest_hyperverge_txn_id" text;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "kyc_skipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD COLUMN "retake_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "roll_date" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "commission_expiry_notice_dismissals" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "commission_expiry_notice_snooze_until" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "sc_commission_status" text;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "sc_commission_status_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "sc_commission_status_admin_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "identity_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "identity_last_expired_at" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "government_id_valid_until" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "government_id_expiry_notice_dismissals" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "government_id_expiry_notice_snooze_until" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "certificate_file_object_id" text;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "kyc_skipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD COLUMN "course_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "appointment_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_required_at" timestamp;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_role" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "compliance_audit_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "enp_profiles" ALTER COLUMN "ibp_date" SET DATA TYPE text USING "ibp_date"::text;--> statement-breakpoint
ALTER TABLE "enp_profiles" ALTER COLUMN "directory_offered_modes" SET DEFAULT ARRAY['remote'::text, 'in_person'::text]::text[];--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT true;--> statement-breakpoint
CREATE INDEX "appointment_document_types_appointment_id_idx" ON "appointment_document_types" ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_document_types_enp_document_type_id_idx" ON "appointment_document_types" ("enp_document_type_id");--> statement-breakpoint
CREATE INDEX "appointment_documents_enp_document_type_id_idx" ON "appointment_documents" ("enp_document_type_id");--> statement-breakpoint
CREATE INDEX "appointments_kind_idx" ON "appointments" ("kind");--> statement-breakpoint
CREATE INDEX "compliance_access_log_actor_idx" ON "compliance_access_log" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "compliance_access_log_action_idx" ON "compliance_access_log" ("action");--> statement-breakpoint
CREATE INDEX "compliance_access_log_occurred_at_idx" ON "compliance_access_log" ("occurred_at");--> statement-breakpoint
CREATE INDEX "compliance_exports_actor_idx" ON "compliance_exports" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "compliance_exports_dataset_idx" ON "compliance_exports" ("dataset");--> statement-breakpoint
CREATE INDEX "dm_conversations_low_user_id_idx" ON "dm_conversations" ("low_user_id");--> statement-breakpoint
CREATE INDEX "dm_conversations_high_user_id_idx" ON "dm_conversations" ("high_user_id");--> statement-breakpoint
CREATE INDEX "dm_messages_conversation_id_created_at_idx" ON "dm_messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "document_review_request_document_types_review_request_id_idx" ON "document_review_request_document_types" ("review_request_id");--> statement-breakpoint
CREATE INDEX "document_review_request_document_types_enp_document_type_id_idx" ON "document_review_request_document_types" ("enp_document_type_id");--> statement-breakpoint
CREATE INDEX "document_review_request_files_file_object_id_idx" ON "document_review_request_files" ("file_object_id");--> statement-breakpoint
CREATE INDEX "document_review_request_files_quicksign_project_id_idx" ON "document_review_request_files" ("quicksign_project_id");--> statement-breakpoint
CREATE INDEX "document_review_requests_client_user_id_idx" ON "document_review_requests" ("client_user_id");--> statement-breakpoint
CREATE INDEX "document_review_requests_enp_user_id_idx" ON "document_review_requests" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "document_review_requests_status_idx" ON "document_review_requests" ("status");--> statement-breakpoint
CREATE INDEX "email_verification_otps_user_id_idx" ON "email_verification_otps" ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_otps_email_idx" ON "email_verification_otps" ("email");--> statement-breakpoint
CREATE INDEX "email_verification_otps_expires_at_idx" ON "email_verification_otps" ("expires_at");--> statement-breakpoint
CREATE INDEX "email_verification_otps_purpose_idx" ON "email_verification_otps" ("purpose");--> statement-breakpoint
CREATE INDEX "email_verification_otps_session_id_idx" ON "email_verification_otps" ("session_id");--> statement-breakpoint
CREATE INDEX "enb_access_requests_enp_user_id_idx" ON "enb_access_requests" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "enb_access_requests_registry_act_id_idx" ON "enb_access_requests" ("registry_act_id");--> statement-breakpoint
CREATE INDEX "enb_access_requests_requester_user_id_idx" ON "enb_access_requests" ("requester_user_id");--> statement-breakpoint
CREATE INDEX "enb_access_requests_outcome_idx" ON "enb_access_requests" ("outcome");--> statement-breakpoint
CREATE INDEX "enp_commission_application_documents_file_object_id_idx" ON "enp_commission_application_documents" ("file_object_id");--> statement-breakpoint
CREATE INDEX "enp_commission_applications_applicant_user_id_idx" ON "enp_commission_applications" ("applicant_user_id");--> statement-breakpoint
CREATE INDEX "enp_commission_applications_sub_org_id_idx" ON "enp_commission_applications" ("sub_org_id");--> statement-breakpoint
CREATE INDEX "enp_commission_applications_status_idx" ON "enp_commission_applications" ("status");--> statement-breakpoint
CREATE INDEX "enp_commission_applications_submitted_at_idx" ON "enp_commission_applications" ("submitted_at");--> statement-breakpoint
CREATE INDEX "enp_commission_applications_summary_hearing_scheduled_at_idx" ON "enp_commission_applications" ("summary_hearing_scheduled_at");--> statement-breakpoint
CREATE INDEX "enp_commission_applications_summary_hearing_appointment_id_idx" ON "enp_commission_applications" ("summary_hearing_appointment_id");--> statement-breakpoint
CREATE INDEX "enp_document_types_enp_user_id_idx" ON "enp_document_types" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "enp_document_types_is_active_idx" ON "enp_document_types" ("is_active");--> statement-breakpoint
CREATE INDEX "ien_notarial_attestations_project_id_idx" ON "ien_notarial_attestations" ("quicksign_project_id");--> statement-breakpoint
CREATE INDEX "ien_notarial_attestations_appointment_id_idx" ON "ien_notarial_attestations" ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ien_notarial_attestations_project_role_user_uidx" ON "ien_notarial_attestations" ("quicksign_project_id","role","user_id");--> statement-breakpoint
CREATE INDEX "liveness_validations_user_id_idx" ON "liveness_validations" ("user_id");--> statement-breakpoint
CREATE INDEX "liveness_validations_appointment_id_idx" ON "liveness_validations" ("appointment_id");--> statement-breakpoint
CREATE INDEX "liveness_validations_user_appointment_idx" ON "liveness_validations" ("user_id","appointment_id");--> statement-breakpoint
CREATE INDEX "maintenance_windows_starts_at_idx" ON "maintenance_windows" ("starts_at");--> statement-breakpoint
CREATE INDEX "maintenance_windows_cancelled_at_idx" ON "maintenance_windows" ("cancelled_at");--> statement-breakpoint
CREATE INDEX "meeting_enb_sig_req_appointment_idx" ON "meeting_enb_signature_requests" ("appointment_id");--> statement-breakpoint
CREATE INDEX "meeting_enb_sig_req_registry_act_idx" ON "meeting_enb_signature_requests" ("registry_act_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_enb_sig_req_act_signer_uidx" ON "meeting_enb_signature_requests" ("registry_act_id","signer_user_id");--> statement-breakpoint
CREATE INDEX "meeting_sig_req_appt_doc_idx" ON "meeting_signature_requests" ("appointment_id","document_file_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_sig_req_meeting_doc_signer_uidx" ON "meeting_signature_requests" ("appointment_id","document_file_object_id","signer_user_id");--> statement-breakpoint
CREATE INDEX "payment_intents_appointment_id_idx" ON "payment_intents" ("appointment_id");--> statement-breakpoint
CREATE INDEX "quicksign_projects_enp_user_id_idx" ON "quicksign_projects" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "quicksign_projects_doconchain_uuid_idx" ON "quicksign_projects" ("doconchain_project_uuid");--> statement-breakpoint
CREATE INDEX "quicksign_projects_notarized_file_object_id_idx" ON "quicksign_projects" ("notarized_file_object_id");--> statement-breakpoint
CREATE INDEX "quicksign_signers_project_id_idx" ON "quicksign_signers" ("project_id");--> statement-breakpoint
CREATE INDEX "quicksign_signers_email_idx" ON "quicksign_signers" ("email");--> statement-breakpoint
CREATE INDEX "registry_acts_enp_user_id_idx" ON "registry_acts" ("enp_user_id");--> statement-breakpoint
CREATE INDEX "registry_acts_appointment_id_idx" ON "registry_acts" ("appointment_id");--> statement-breakpoint
CREATE INDEX "registry_acts_sc_status_idx" ON "registry_acts" ("sc_status");--> statement-breakpoint
CREATE INDEX "registry_acts_entry_number_idx" ON "registry_acts" ("entry_number");--> statement-breakpoint
CREATE INDEX "registry_acts_completion_status_idx" ON "registry_acts" ("completion_status");--> statement-breakpoint
CREATE INDEX "messages_session_room_id_created_at_idx" ON "messages" ("session_room_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_user_id_idx" ON "messages" ("sender_user_id");--> statement-breakpoint
CREATE INDEX "session_room_guests_user_id_idx" ON "session_room_guests" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_rooms_appointment_id_uidx" ON "session_rooms" ("appointment_id");--> statement-breakpoint
CREATE INDEX "session_rooms_livekit_room_name_idx" ON "session_rooms" ("livekit_room_name");--> statement-breakpoint
ALTER TABLE "appointment_document_types" ADD CONSTRAINT "appointment_document_types_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "appointment_document_types" ADD CONSTRAINT "appointment_document_types_NO5eVxGmehMM_fkey" FOREIGN KEY ("enp_document_type_id") REFERENCES "enp_document_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "appointment_documents" ADD CONSTRAINT "appointment_documents_Xj8AG72d820H_fkey" FOREIGN KEY ("enp_document_type_id") REFERENCES "enp_document_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_SQ0ytcBTmohX_fkey" FOREIGN KEY ("latest_hyperverge_txn_id") REFERENCES "hyperverge_transactions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "compliance_access_log" ADD CONSTRAINT "compliance_access_log_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_exports" ADD CONSTRAINT "compliance_exports_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "compliance_exports" ADD CONSTRAINT "compliance_exports_file_object_id_file_objects_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_low_user_id_users_id_fkey" FOREIGN KEY ("low_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_high_user_id_users_id_fkey" FOREIGN KEY ("high_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_conversation_id_dm_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "dm_conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_sender_user_id_users_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_review_request_document_types" ADD CONSTRAINT "document_review_request_document_types_Pi5jJbo6O8Np_fkey" FOREIGN KEY ("review_request_id") REFERENCES "document_review_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_review_request_document_types" ADD CONSTRAINT "document_review_request_document_types_r2d7VEJpH8YJ_fkey" FOREIGN KEY ("enp_document_type_id") REFERENCES "enp_document_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_review_request_files" ADD CONSTRAINT "document_review_request_files_VB1Hau74O5Dl_fkey" FOREIGN KEY ("review_request_id") REFERENCES "document_review_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_review_request_files" ADD CONSTRAINT "document_review_request_files_yxtDL6hElLip_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_review_request_files" ADD CONSTRAINT "document_review_request_files_pWQmzOKOpca1_fkey" FOREIGN KEY ("quicksign_project_id") REFERENCES "quicksign_projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "document_review_requests" ADD CONSTRAINT "document_review_requests_client_user_id_users_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_review_requests" ADD CONSTRAINT "document_review_requests_enp_user_id_users_id_fkey" FOREIGN KEY ("enp_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_review_requests" ADD CONSTRAINT "document_review_requests_a0J2j904sj7S_fkey" FOREIGN KEY ("approved_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "document_review_requests" ADD CONSTRAINT "document_review_requests_jszpxvBXh2vj_fkey" FOREIGN KEY ("active_quicksign_project_id") REFERENCES "quicksign_projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_enp_user_id_users_id_fkey" FOREIGN KEY ("enp_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_registry_act_id_registry_acts_id_fkey" FOREIGN KEY ("registry_act_id") REFERENCES "registry_acts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_requester_user_id_users_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_qj2zdHOUum9U_fkey" FOREIGN KEY ("document_file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_QYoVwzDWxKr6_fkey" FOREIGN KEY ("requester_signature_file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enb_access_requests" ADD CONSTRAINT "enb_access_requests_VwogzkIwbORB_fkey" FOREIGN KEY ("identity_evidence_file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enp_commission_application_documents" ADD CONSTRAINT "enp_commission_application_documents_YsLq7hgr0quo_fkey" FOREIGN KEY ("application_id") REFERENCES "enp_commission_applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enp_commission_application_documents" ADD CONSTRAINT "enp_commission_application_documents_k8d4YIcyVgO2_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enp_commission_applications" ADD CONSTRAINT "enp_commission_applications_applicant_user_id_users_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enp_commission_applications" ADD CONSTRAINT "enp_commission_applications_sub_org_id_sub_orgs_id_fkey" FOREIGN KEY ("sub_org_id") REFERENCES "sub_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enp_commission_applications" ADD CONSTRAINT "enp_commission_applications_lFr4iNC3Xlco_fkey" FOREIGN KEY ("summary_hearing_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enp_commission_applications" ADD CONSTRAINT "enp_commission_applications_GoxlNTGUaPNs_fkey" FOREIGN KEY ("summary_hearing_scheduled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enp_document_types" ADD CONSTRAINT "enp_document_types_enp_user_id_users_id_fkey" FOREIGN KEY ("enp_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enp_profiles" ADD CONSTRAINT "enp_profiles_certificate_file_object_id_file_objects_id_fkey" FOREIGN KEY ("certificate_file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ien_notarial_attestations" ADD CONSTRAINT "ien_notarial_attestations_TsTnQLg60wlQ_fkey" FOREIGN KEY ("quicksign_project_id") REFERENCES "quicksign_projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ien_notarial_attestations" ADD CONSTRAINT "ien_notarial_attestations_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ien_notarial_attestations" ADD CONSTRAINT "ien_notarial_attestations_MTGYt2D1tXe8_fkey" FOREIGN KEY ("document_file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ien_notarial_attestations" ADD CONSTRAINT "ien_notarial_attestations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "liveness_validations" ADD CONSTRAINT "liveness_validations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "liveness_validations" ADD CONSTRAINT "liveness_validations_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "maintenance_windows" ADD CONSTRAINT "maintenance_windows_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "meeting_enb_signature_requests" ADD CONSTRAINT "meeting_enb_signature_requests_b53clUfDkhh8_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meeting_enb_signature_requests" ADD CONSTRAINT "meeting_enb_signature_requests_p21fGrFMt92Y_fkey" FOREIGN KEY ("registry_act_id") REFERENCES "registry_acts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meeting_enb_signature_requests" ADD CONSTRAINT "meeting_enb_signature_requests_signer_user_id_users_id_fkey" FOREIGN KEY ("signer_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meeting_signature_requests" ADD CONSTRAINT "meeting_signature_requests_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meeting_signature_requests" ADD CONSTRAINT "meeting_signature_requests_b10PJlACoGGa_fkey" FOREIGN KEY ("document_file_object_id") REFERENCES "file_objects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meeting_signature_requests" ADD CONSTRAINT "meeting_signature_requests_signer_user_id_users_id_fkey" FOREIGN KEY ("signer_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quicksign_projects" ADD CONSTRAINT "quicksign_projects_enp_user_id_users_id_fkey" FOREIGN KEY ("enp_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "quicksign_projects" ADD CONSTRAINT "quicksign_projects_document_file_object_id_file_objects_id_fkey" FOREIGN KEY ("document_file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "quicksign_projects" ADD CONSTRAINT "quicksign_projects_K6ajeCuKKtod_fkey" FOREIGN KEY ("notarized_file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quicksign_projects" ADD CONSTRAINT "quicksign_projects_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quicksign_signers" ADD CONSTRAINT "quicksign_signers_project_id_quicksign_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "quicksign_projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "registry_acts" ADD CONSTRAINT "registry_acts_enp_user_id_users_id_fkey" FOREIGN KEY ("enp_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "registry_acts" ADD CONSTRAINT "registry_acts_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "registry_protest_proceedings" ADD CONSTRAINT "registry_protest_proceedings_mPYSsrg7SFxg_fkey" FOREIGN KEY ("registry_act_id") REFERENCES "registry_acts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_room_id_session_rooms_id_fkey" FOREIGN KEY ("session_room_id") REFERENCES "session_rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "session_room_guests" ADD CONSTRAINT "session_room_guests_session_room_id_session_rooms_id_fkey" FOREIGN KEY ("session_room_id") REFERENCES "session_rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_room_guests" ADD CONSTRAINT "session_room_guests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_rooms" ADD CONSTRAINT "session_rooms_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;