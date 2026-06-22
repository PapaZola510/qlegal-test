# FE-06 — Orchestrator: rewire navigation, gates, stepper UI

**Track:** frontend · **Depends on:** FE-01..FE-05 · **Skill:** `nextjs-app-router`, `tailwind-shadcn`

## Goal
Rewire `quicksign-content.tsx` to drive the new 5-step order, render the new step
components, and enforce per-step advance gates. Keep the inline stepper (no shared
component), just reordered/renamed.

## Context
- `apps/web/features/quicksign/components/quicksign-content.tsx`
  - state container `useState<QuickSignState>` (`:65`)
  - `patch()` navigation (`:196`)
  - inline stepper render (`:488-518`)
  - per-step conditional render (`:521-589`)
  - project-creation handler (old upload step) + `handleCreateMeeting()` (`:312-355`).

## Changes
1. Render order: `assign_signer` → `select_types` → `upload` → `plot_fields` →
   `create_meeting`, mapping each to its component (FE-03, FE-04, FE-05, existing
   plot + meeting steps).
2. Advance gates:
   - `assign_signer`: valid email + non-empty first/last name
   - `select_types`: `documentTypeIds.length > 0`
   - `upload`: file chosen + notarization type set (create runs on submit → FE-05)
   - `plot_fields`: `plotFields.confirmed`
   - `create_meeting`: terminal
3. Stepper UI (`:488-518`): drive labels/numbers from the updated `WIZARD_STEPS`; keep
   checkmark/circle/connector styling. Use `size-*` for square dims.
4. Move the project-creation logic into the upload step's submit (FE-05) or expose it
   as a handler the upload step calls; remove the assumption that create happens at the
   first step.
5. Keep the document-review bootstrap integration working: if a review pre-fills signer
   + notarization, land the user appropriately (e.g. on `select_types` or `upload`
   with signer prefilled) instead of the old `add_signer` landing. Preserve the
   resumable-project restore path.
6. Optionally show selected types in the create-meeting summary.

## Acceptance criteria
- All 5 steps navigate forward/back with correct gates; can't skip ahead.
- Stepper highlights the active step and checks completed ones.
- Review-bootstrap and resume flows still function.
- No dead references to old step ordering.
- `pnpm typecheck` + lint clean.
