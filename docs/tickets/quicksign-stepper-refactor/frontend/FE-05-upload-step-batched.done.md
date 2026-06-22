# FE-05 — Step 3: Upload triggers batched project creation

**Track:** frontend · **Depends on:** FE-01, FE-02, BE-02 · **Skill:** `tailwind-shadcn`, `tanstack-query-orpc`

## Goal
The upload step uploads the PDF, then creates the project in **one** call that also
carries the signer (step 1) and the selected document types (step 2).

## Context
- Component: `apps/web/features/quicksign/components/step-upload.tsx` — file picker,
  document name, notarization type.
- File upload helper: `apps/web/features/quicksign/lib/upload-quicksign-file.ts`
  (multipart → `/v1/files`, purpose `qs_original`).
- Create mutation: `useCreateQuicksignProjectMutation()` (FE-02 / BE-02 extended).
- Project-creation handler today lives in the orchestrator (`quicksign-content.tsx`)
  and runs on the old step-1 upload — relocate/adjust that handler, don't duplicate.

## Changes
1. The upload step's submit flow becomes:
   1. upload file → `documentFileId`
   2. call create mutation with:
      ```ts
      {
        title: upload.fileName,
        documentFileId,
        signer: { firstName, lastName, email },        // from state (step 1)
        enpDocumentTypeIds: documentTypeIds,            // from state (step 2)
      }
      ```
   3. on success: store `projectId`, `projectRef`, `documentFileId`, mark signer added,
      advance to `plot_fields`.
2. Keep notarization-type selection on this step (it feeds `finalize`, not create).
3. Preserve existing error handling (`errorCode`, retry-without-reupload). The retry
   path must resend signer + doctypes too.
4. Guard: this step assumes steps 1–2 are complete (orchestrator enforces order).

## Acceptance criteria
- One create request includes signer + doctypes; project comes back with a signer and
  `documentTypes` populated.
- Error/retry flows still work and resend the batched payload.
- No separate add-signer call in the happy path.
- `pnpm typecheck` + lint clean.
