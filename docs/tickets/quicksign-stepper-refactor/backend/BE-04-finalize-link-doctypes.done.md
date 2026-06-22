# BE-04 — Service: link document types to appointment on finalize

**Track:** backend · **Depends on:** BE-01, BE-03 · **Skill:** `nestjs-framework`, `drizzle-postgres`

## Goal
When a quicksign project is finalized into an appointment, copy its selected document
types onto the appointment so pricing/records match the standard booking flow.

## Context
- `finalize()` — `apps/backend/src/modules/v1/quicksign/quicksign.service.ts:804-972`.
  Creates the `appointments` row (`:858-877`) and links the document via
  `appointmentDocuments` (`:881-887`), but creates **no** `appointmentDocumentTypes`
  rows today.
- Booking-flow reference for the join insert: `appointments.service.ts:1562-1569`.
- Source of types: `quicksignProjectDocumentTypes` (BE-01).

## Changes
1. After the appointment row is created (`:877`), query
   `quicksignProjectDocumentTypes` for `project.id` and insert matching
   `appointmentDocumentTypes` rows — carry `pricePhpSnapshot` straight through (do
   **not** re-read live prices; preserve the snapshot frozen at selection time).
2. If the project has zero doctype rows (legacy/old-flow projects), skip silently —
   keep finalize backward compatible.
3. Include the linked types in the finalize response if useful for the UI summary
   (optional; coordinate with BE-02 output shape).

## Acceptance criteria
- Finalizing a project that has doctypes creates the corresponding
  `appointmentDocumentTypes` rows with identical snapshot prices.
- Finalizing a legacy project (no doctypes) still succeeds.
- Existing finalize behavior (appointment, session room, signers, email) unchanged.
- `pnpm typecheck` + lint clean.
