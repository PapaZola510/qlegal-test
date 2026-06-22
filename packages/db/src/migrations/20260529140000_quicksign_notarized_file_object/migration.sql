ALTER TABLE "quicksign_projects" ADD COLUMN IF NOT EXISTS "notarized_file_object_id" text REFERENCES "file_objects"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "quicksign_projects_notarized_file_object_id_idx" ON "quicksign_projects" ("notarized_file_object_id");
