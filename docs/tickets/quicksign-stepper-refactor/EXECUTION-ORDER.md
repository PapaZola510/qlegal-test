# Quicksign Stepper Refactor — Execution Order

> Feature: reorder + extend the ENP quicksign wizard at `/quicksign` to mirror the
> Client(Principal) `/upload-document` flow.
>
> **New step order (5 steps):**
> 1. **Assign Signers** — principal email / first / last name
> 2. **Select Types** — ENP document types (priced, multi-select)
> 3. **Upload Document** — PDF + notarization type
> 4. **Plot Fields** — DocOnChain plotter
> 5. **Create Meeting** — schedule + finalize

---

## Architecture decision (read first)

The current flow creates the quicksign project at the **upload** step (it needs the
file). In the new order, **signer** and **types** are collected *before* the upload.
There is no project to attach them to yet, so:

- **Steps 1 (signer) and 2 (types) write to client state only** — no API calls.
- **Step 3 (upload)** uploads the file, then calls the **extended** `POST /quicksign`
  with `{ title, documentFileId, signer, enpDocumentTypeIds }` in one shot. The
  backend creates the project, the DocOnChain project, registers the signer, and
  snapshots the selected document-type prices.
- **Step 5 (finalize)** additionally links the project's document types onto the
  created appointment (`appointmentDocumentTypes`), mirroring the booking flow.

The standalone `POST /quicksign/{id}/signers` endpoint is **kept** as a fallback /
add-additional-signer path; the new flow just no longer requires it for the first
signer.

---

## Dependency graph

```
BE-01 (db table) ─┐
                  ├─> BE-03 (create service) ─> BE-04 (finalize link) ─> BE-05 (tests)
BE-02 (contracts)─┘            │
                              (BE-02 also unblocks FE-02, FE-05)

FE-01 (state model) ─> FE-03 (signer step) ─┐
                    ─> FE-04 (types step)   ├─> FE-06 (orchestrator) ─> FE-07 (session)
FE-02 (hooks) ───────> FE-05 (upload step) ─┘
```

## Recommended execution order

Run **backend first** so contract types exist before frontend wires to them. FE-01,
FE-03, FE-04 are pure-UI/state and can start in parallel with the backend; FE-02 and
FE-05 must wait for BE-02.

| # | Ticket | Track | Depends on | Parallel-safe with |
|---|--------|-------|------------|--------------------|
| 1 | BE-01-db-quicksign-document-types | backend | — | FE-01, FE-03, FE-04 |
| 2 | BE-02-contract-extend-create | backend | — | FE-01, FE-03, FE-04 |
| 3 | BE-03-service-batched-create | backend | BE-01, BE-02 | FE-01, FE-03, FE-04 |
| 4 | BE-04-finalize-link-doctypes | backend | BE-01, BE-03 | frontend track |
| 5 | BE-05-backend-tests | backend | BE-03, BE-04 | frontend track |
| 6 | FE-01-state-model | frontend | — | all backend |
| 7 | FE-02-api-hooks | frontend | BE-02 | FE-03, FE-04 |
| 8 | FE-03-assign-signer-step | frontend | FE-01 | FE-02, FE-04 |
| 9 | FE-04-select-types-step | frontend | FE-01, FE-02 | FE-03 |
| 10 | FE-05-upload-step-batched | frontend | FE-01, FE-02, BE-02 | FE-03, FE-04 |
| 11 | FE-06-orchestrator-rewire | frontend | FE-01..FE-05 | — |
| 12 | FE-07-session-persistence | frontend | FE-01, FE-06 | — |

## Definition of done (feature-level)

- Wizard renders 5 steps in the new order with correct labels + progress UI.
- Steps 1–2 hold data in client state; no network call until step 3.
- `POST /quicksign` creates project + DocOnChain project + first signer + doctype
  snapshots in one request.
- Finalize links selected document types to the appointment.
- Session persistence survives reload across all 5 steps.
- `pnpm lint && pnpm typecheck` clean. Backend specs pass.
- Skills to load per CLAUDE.md: backend tickets → `drizzle-postgres`, `orpc-contracts`,
  `nestjs-framework`; frontend tickets → `nextjs-app-router`, `tailwind-shadcn`,
  `tanstack-query-orpc`.
