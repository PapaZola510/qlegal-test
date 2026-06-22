CREATE TABLE "meeting_signature_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"appointment_id" text NOT NULL,
	"document_file_object_id" text NOT NULL,
	"signer_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "meeting_signature_requests" ADD CONSTRAINT "meeting_signature_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "meeting_signature_requests" ADD CONSTRAINT "meeting_signature_requests_document_file_object_id_file_objects_id_fk" FOREIGN KEY ("document_file_object_id") REFERENCES "public"."file_objects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "meeting_signature_requests" ADD CONSTRAINT "meeting_signature_requests_signer_user_id_users_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "meeting_sig_req_appt_doc_idx" ON "meeting_signature_requests" ("appointment_id","document_file_object_id");

CREATE UNIQUE INDEX "meeting_sig_req_meeting_doc_signer_uidx" ON "meeting_signature_requests" ("appointment_id","document_file_object_id","signer_user_id");
