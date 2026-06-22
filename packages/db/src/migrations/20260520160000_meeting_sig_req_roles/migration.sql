ALTER TABLE "meeting_signature_requests" ADD COLUMN "signer_role" text DEFAULT 'principal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "meeting_signature_requests" ADD COLUMN "signing_order" integer DEFAULT 1 NOT NULL;
