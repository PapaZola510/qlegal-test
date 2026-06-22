# FE-04 — Step 2 component: Select Types (ENP document types)

**Track:** frontend · **Depends on:** FE-01, FE-02 · **Skill:** `tailwind-shadcn`, `tanstack-query-orpc`

## Goal
New step that lets the ENP pick one or more of their own priced document types,
mirroring the `/upload-document` "Types" step.

## Context
- Reference UI: `apps/web/features/document-review/components/upload-document-wizard.tsx:143-160`
  uses `EnpDocumentTypeMultiSelect` with `selectedIds` / `onSelectedIdsChange`.
- Reuse the existing `EnpDocumentTypeMultiSelect` component (find its path in the
  enp-document-types feature; do not fork it).
- Data: `useMyEnpDocumentTypesQuery()` from FE-02 (the logged-in ENP's types).

## Changes
1. Create `apps/web/features/quicksign/components/step-select-types.tsx`:
   ```ts
   interface StepSelectTypesProps {
     selectedIds: string[]
     onChange: (ids: string[]) => void
   }
   ```
2. Inside, call `useMyEnpDocumentTypesQuery()` and render `EnpDocumentTypeMultiSelect`
   with `types`, `isLoading`, `isError`, `selectedIds`, `onSelectedIdsChange={onChange}`.
3. Empty/loading/error states: reuse the reference component's props
   (`emptyMessage="You have no active document types yet."`).
4. Heading copy: "Document type(s)" + helper "Choose one or more of your types. This
   controls pricing."

## Acceptance criteria
- Step lists the ENP's active types and supports multi-select into `documentTypeIds`.
- Advance gate (FE-06) requires ≥1 selected.
- No duplicate multi-select implementation; the shared component is reused.
- `pnpm typecheck` + lint clean.
