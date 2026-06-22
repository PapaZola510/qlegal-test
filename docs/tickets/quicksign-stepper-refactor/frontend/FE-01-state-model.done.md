# FE-01 — State model: 5-step reorder + document types

**Track:** frontend · **Depends on:** none · **Skill:** `nextjs-app-router`

## Goal
Update the wizard's step definitions and state shape to the new 5-step order and add
document-type selection state.

## Context
- `apps/web/features/quicksign/lib/fixtures.ts`
  - Step enum + array (`:20-27`):
    ```ts
    export type WizardStep = "upload" | "add_signer" | "plot_fields" | "create_meeting"
    export const WIZARD_STEPS = [
      { key: "upload", label: "Upload Document", number: 1 },
      { key: "add_signer", label: "Add Signer", number: 2 },
      { key: "plot_fields", label: "Plot Fields", number: 3 },
      { key: "create_meeting", label: "Create Meeting", number: 4 },
    ]
    ```
  - `QuickSignState` (`:69-105`) holds `step`, `upload`, `signer`, `plotFields`,
    `meeting`, etc.

## Changes
1. New step enum + ordered array:
   ```ts
   export type WizardStep =
     | "assign_signer" | "select_types" | "upload" | "plot_fields" | "create_meeting"
   export const WIZARD_STEPS = [
     { key: "assign_signer", label: "Assign Signer", number: 1 },
     { key: "select_types", label: "Select Types", number: 2 },
     { key: "upload", label: "Upload Document", number: 3 },
     { key: "plot_fields", label: "Plot Fields", number: 4 },
     { key: "create_meeting", label: "Create Meeting", number: 5 },
   ]
   ```
2. `QuickSignState`: add
   - `documentTypeIds: string[]` (selected in step 2)
   - keep existing `signer: SignerPayload` (now entered in step 1)
   - set the initial `step` to `"assign_signer"`.
3. Update the initial-state factory so the wizard starts on `assign_signer` with empty
   `documentTypeIds`.
4. Update the `SignerPayload`/`UploadPayload` types only if needed (signer stays as-is;
   notarization type stays on the upload step).

## Acceptance criteria
- Types compile; no remaining references to the old `"add_signer"` key in fixtures.
- `documentTypeIds` defaults to `[]`.
- Do not touch components yet (separate tickets); just the model.
