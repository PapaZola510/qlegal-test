# BE-02 — Contracts: extend create-project schema (signer + document types)

**Track:** backend · **Depends on:** none · **Skill:** `orpc-contracts`

## Goal
Let `POST /quicksign` accept the signer and selected ENP document types at creation
time, so the new flow can batch steps 1–3 into a single request. Surface the linked
document types on the project output so the UI can render them.

## Context
- Contract file: `packages/contracts/src/modules/v1/quicksign/quicksign.schema.ts`.
- Current create schema (`quicksign.schema.ts:56-60`):
  ```ts
  export const CreateQuicksignProjectSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    documentFileId: z.string().min(1),
  })
  ```
- Add-signer schema for field reuse: `quicksign.schema.ts:66-72`.
- Reference for doctype selection input: `CreateAppointmentSchema` (`documentTypeIds: string[]`)
  and `EnpDocumentTypeSchema` in the enp-document-types contract.

## Changes
1. Extend `CreateQuicksignProjectSchema`:
   ```ts
   export const CreateQuicksignProjectSchema = z.object({
     title: z.string().min(1).max(255),
     description: z.string().optional(),
     documentFileId: z.string().min(1),
     signer: z.object({
       firstName: z.string().min(1).max(120),
       lastName: z.string().min(1).max(120),
       email: z.string().email(),
     }).optional(),
     enpDocumentTypeIds: z.array(z.string().min(1)).min(1).max(10).optional(),
   })
   ```
   Keep both fields **optional** for backward compatibility with the old flow.
2. Extend the `QuicksignProject` output schema to include the selected types, e.g.:
   ```ts
   documentTypes: z.array(z.object({
     id: z.string(),
     name: z.string(),
     pricePhpSnapshot: z.number().int(),
   })).default([]),
   ```
3. Export any new inferred types alongside existing ones. No path/route changes.

## Acceptance criteria
- Schema compiles; `@repo/contracts` builds.
- Old callers (title/description/file only) still validate.
- `pnpm typecheck` clean across web + backend.

## Notes
Per `no-barrel`/co-location rules, keep schemas in the contracts package (allowed
exception). Do not introduce a new contract file unless the existing one grows
unwieldy.
