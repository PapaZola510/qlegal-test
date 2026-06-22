# BE-01 — DB: quicksign ↔ ENP document-types join table

**Track:** backend · **Depends on:** none · **Skill:** `drizzle-postgres`

## Goal
Add a join table linking a quicksign project to the ENP document types selected in
the new "Select Types" step, with a frozen price snapshot — mirroring the existing
`appointmentDocumentTypes` / `documentReviewRequestDocumentTypes` patterns.

## Context
- ENP document types table already exists: `enpDocumentTypes` — `packages/db/src/schema.ts:1649-1670`
  (columns: `id`, `enpUserId`, `name`, `pricePhp`, `isActive`, timestamps).
- Existing join pattern to copy: `appointmentDocumentTypes` — `packages/db/src/schema.ts:1672-1692`
  (composite PK, `pricePhpSnapshot`).
- Quicksign project table: `quicksignProjects` (find in `packages/db/src/schema.ts`).

## Changes
1. Add `quicksignProjectDocumentTypes` table in `packages/db/src/schema.ts`:
   ```ts
   export const quicksignProjectDocumentTypes = createTable(
     "quicksign_project_document_types",
     t => ({
       projectId: t.text("project_id").notNull()
         .references(() => quicksignProjects.id, { onDelete: "cascade" }),
       enpDocumentTypeId: t.text("enp_document_type_id").notNull()
         .references(() => enpDocumentTypes.id, { onDelete: "restrict" }),
       pricePhpSnapshot: t.integer("price_php_snapshot").notNull(),
       createdAt: t.timestamp("created_at").notNull().defaultNow(),
     }),
     t => [
       primaryKey({ columns: [t.projectId, t.enpDocumentTypeId] }),
       index("quicksign_project_document_types_project_id_idx").on(t.projectId),
     ]
   )
   ```
2. Add relations if the schema file declares relations for `quicksignProjects` /
   `enpDocumentTypes` (match surrounding style).
3. Generate migration: `pnpm db:generate`. Do **not** hand-edit generated SQL.

## Acceptance criteria
- Table + indexes + composite PK match the `appointmentDocumentTypes` convention.
- `pnpm db:generate` produces a migration; `pnpm typecheck` clean.
- No change to existing tables.

## Notes
Keep `onDelete: "restrict"` on the doc-type FK so historical projects can't lose
their priced types; `cascade` on the project FK so deleting a draft cleans up.
