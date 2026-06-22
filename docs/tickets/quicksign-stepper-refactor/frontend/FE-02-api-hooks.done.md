# FE-02 — API hooks: extended create + ENP own document types

**Track:** frontend · **Depends on:** BE-02 · **Skill:** `tanstack-query-orpc`

## Goal
Wire the extended create-project input and add a hook to fetch the current ENP's own
document types for the "Select Types" step.

## Context
- `apps/web/features/quicksign/api/quicksign.hooks.ts`
  - `useCreateQuicksignProjectMutation()` → `POST /quicksign` (`:` create section).
- Reference doctype hook (Client side): `useEnpDocumentTypesForEnpQuery(enpId)` in the
  enp-document-types feature — it calls `enpDocumentType.listForEnp` with `{ enpId }`.
- Current user id: `useAuthProfileMeQuery()` (dashboard feature) exposes the logged-in
  ENP's user id.

## Changes
1. `useCreateQuicksignProjectMutation` — the mutation input now flows through oRPC
   types automatically once BE-02 lands; confirm callers can pass
   `{ title, documentFileId, signer?, enpDocumentTypeIds? }`. No manual typing needed
   if it uses `orpc.<...>.create.mutationOptions()`.
2. Add a thin hook for the ENP's own types, e.g. in `quicksign.hooks.ts`:
   ```ts
   export function useMyEnpDocumentTypesQuery() {
     const me = useAuthProfileMeQuery()
     const enpId = me.data?.id ?? null
     return useQuery(
       orpc.enpDocumentType.listForEnp.queryOptions({
         input: { enpId: enpId! },
         enabled: Boolean(enpId),
       })
     )
   }
   ```
   (Match the exact orpc path used by the existing client-side hook.)

## Acceptance criteria
- Create mutation accepts the new optional fields with full type-safety.
- `useMyEnpDocumentTypesQuery()` returns the active types for the logged-in ENP and is
  disabled until the user id is known.
- `pnpm typecheck` clean.
