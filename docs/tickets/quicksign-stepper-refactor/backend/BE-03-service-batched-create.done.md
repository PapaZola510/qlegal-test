# BE-03 — Service: batched project creation (signer + doctype snapshots)

**Track:** backend · **Depends on:** BE-01, BE-02 · **Skill:** `nestjs-framework`, `drizzle-postgres`

## Goal
Make `QuicksignService.create()` optionally register the first signer and persist the
selected ENP document types (with frozen prices) in the same call, so the frontend
can create the project in one request at the upload step.

## Context
- `create()` — `apps/backend/src/modules/v1/quicksign/quicksign.service.ts:250-313`.
  Currently: validates file → inserts `quicksignProjects` (status `draft`) → creates
  DocOnChain project → updates row to `pending_signatures` → returns shaped project
  with empty signers.
- `addSigner()` — same file `:347-408` — DocOnChain `addSigner` + insert into
  `quicksignSigners`. Reuse this logic; do not duplicate the DocOnChain call.
- Price validation reference: `EnpDocumentTypesService.resolveAndValidateSelection()`
  (used by appointments — check `appointments.service.ts` around the doctype insert
  `:1562-1569`). Reuse it to validate that all `enpDocumentTypeIds` belong to this ENP
  and are active, and to read current `pricePhp` for the snapshot.

## Changes
1. After the project row + DocOnChain project are created (`:288-296`):
   - If `input.enpDocumentTypeIds?.length`: validate ownership/active via the ENP
     doc-types service, then insert rows into `quicksignProjectDocumentTypes` with
     `pricePhpSnapshot` = current price.
   - If `input.signer`: call the existing signer-registration path (extract the body
     of `addSigner` into a private helper `registerSigner(project, signer, order)` and
     call it here with `order = 1`).
2. Do this inside the existing transaction if `create()` uses one; otherwise wrap the
   project insert + doctype insert + signer insert so a failure rolls back cleanly.
   The DocOnChain calls are non-transactional — keep current ordering (DC project
   first, then signer registration) and surface `DC_SIGNER_FAILED` as today.
3. Update the project shaper to include `documentTypes` (join `quicksignProjectDocumentTypes`
   → `enpDocumentTypes` for name) in the returned object (matches BE-02 output schema).
4. Keep `addSigner()` endpoint working for additional signers.

## Acceptance criteria
- Creating with `signer` + `enpDocumentTypeIds` yields a project that has one signer,
  N doctype rows with snapshot prices, and a valid DocOnChain UUID.
- Creating without them behaves exactly as before.
- Invalid/foreign/inactive doctype id → validation error, project not left half-created.
- `pnpm typecheck` + lint clean.

## Notes
Respect the existing ENP-commission asserts at the top of `create()` (`:254-256`).
