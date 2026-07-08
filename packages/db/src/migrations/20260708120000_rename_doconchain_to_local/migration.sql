ALTER TABLE "quicksign_projects" RENAME COLUMN "doconchain_project_uuid" TO "local_project_uuid";

ALTER INDEX "quicksign_projects_doconchain_uuid_idx" RENAME TO "quicksign_projects_local_project_uuid_idx";
