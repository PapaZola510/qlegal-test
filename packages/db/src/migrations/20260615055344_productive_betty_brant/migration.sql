CREATE TABLE "quicksign_project_document_types" (
	"project_id" text NOT NULL,
	"enp_document_type_id" text NOT NULL,
	"price_php_snapshot" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quicksign_project_document_types_pkey" PRIMARY KEY("project_id","enp_document_type_id")
);
--> statement-breakpoint
CREATE INDEX "quicksign_project_document_types_project_id_idx" ON "quicksign_project_document_types" ("project_id");
--> statement-breakpoint
ALTER TABLE "quicksign_project_document_types" ADD CONSTRAINT "quicksign_project_document_types_project_id_quicksign_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "quicksign_projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quicksign_project_document_types" ADD CONSTRAINT "quicksign_project_document_types_enp_document_type_id_enp_document_types_id_fk" FOREIGN KEY ("enp_document_type_id") REFERENCES "enp_document_types"("id") ON DELETE restrict ON UPDATE no action;
