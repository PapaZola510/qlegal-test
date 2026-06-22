# BE-05 — Tests: batched create + finalize doctype linking

**Track:** backend · **Depends on:** BE-03, BE-04 · **Skill:** `testing-strategies`

## Goal
Cover the new batched-create and finalize-linking behavior.

## Context
- Existing spec: `apps/backend/src/modules/v1/quicksign/quicksign.controller.spec.ts`
  (and any `*.service.spec.ts`). Follow the existing mocking style for DocOnChain
  provision + DB.

## Changes / cases to add
1. **create() with signer + enpDocumentTypeIds**
   - asserts project created, one `quicksignSigners` row, N `quicksignProjectDocumentTypes`
     rows with snapshot prices, DocOnChain `addSigner` called once.
2. **create() without signer/types** — unchanged behavior (regression guard).
3. **create() with foreign/inactive doctype id** — throws validation error, no
   partial project.
4. **finalize() with project doctypes** — creates `appointmentDocumentTypes` rows
   carrying the snapshot prices.
5. **finalize() legacy project (no doctypes)** — succeeds, creates none.

## Acceptance criteria
- New cases pass; existing quicksign specs still green.
- `pnpm test` (or the backend test script) passes locally.
