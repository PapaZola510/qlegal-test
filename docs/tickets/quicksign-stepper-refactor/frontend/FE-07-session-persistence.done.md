# FE-07 — Session persistence: new fields + step order

**Track:** frontend · **Depends on:** FE-01, FE-06 · **Skill:** `nextjs-app-router`

## Goal
Make sessionStorage persistence carry the new state (`documentTypeIds`, signer-first
ordering) so a reload at any of the 5 steps restores correctly.

## Context
- `apps/web/features/quicksign/lib/quicksign-session.ts`
  - `savePersistedQuicksignSession()` (`:75-101`) + the restore reader.
- Restore is applied on mount in `quicksign-content.tsx:111-155`.

## Changes
1. Include `documentTypeIds` in the persisted snapshot and the restore parse.
2. Ensure the persisted `step` value validates against the new `WizardStep` union;
   migrate/bump the storage key or version so stale sessions with the old
   `"add_signer"` step don't crash restore (fall back to `"assign_signer"`).
3. Verify restore re-hydrates signer + documentTypeIds + upload + project refs and
   lands on the persisted step.

## Acceptance criteria
- Reload at each step restores state and the correct step.
- Stale/old-shape sessions degrade gracefully (no throw; reset to step 1 if invalid).
- `pnpm typecheck` + lint clean.
