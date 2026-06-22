# FE-03 — Step 1 component: Assign Signer (local state, no API)

**Track:** frontend · **Depends on:** FE-01 · **Skill:** `tailwind-shadcn`

## Goal
Repurpose the signer step as the **first** step. It collects principal email / first /
last name into client state only — no project exists yet, so no API call.

## Context
- Current component: `apps/web/features/quicksign/components/step-add-signer.tsx`
  — today it calls the add-signer mutation against an existing `projectRef`.
- It will now run before any project is created.

## Changes
1. Rename/refactor to `step-assign-signer.tsx` (kebab-case, per naming rules). Remove
   the `projectRef`, `isLoading`, mutation/`onSubmit`-to-API props.
2. Props become purely controlled state:
   ```ts
   interface StepAssignSignerProps {
     signer: SignerPayload
     onChange: (next: SignerPayload) => void
   }
   ```
3. Validation lives in the orchestrator's advance-gate (FE-06): require valid email +
   non-empty first/last name before "Next". The component just renders inputs +
   inline field hints.
4. Keep existing field styling/labels; drop any "registered with DocOnChain" copy that
   implies an immediate API call.

## Acceptance criteria
- Component renders with no network calls.
- Editing fields calls `onChange` and reflects in parent state.
- No references to the create/add-signer mutation remain in this component.
- `pnpm lint` clean (use `size-*` for square icons per Tailwind rule).
