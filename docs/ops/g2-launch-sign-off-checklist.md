# G2 — Launch sign-off checklist (Epic cutover)

**Epic:** Quanby Legal v2 → qlegal-new migration  
**Use:** Complete before enabling automated promotion to production (`AUTO_PROMOTE_STAGING_TO_PRODUCTION`). Store completed PDF or copy in your program archive.

---

## Launch criterion 1 — E2E QA in staging

**Requirement:** All in-scope parity flows pass end-to-end QA in staging.

| Flow | Staging verified | Owner | Date | Evidence link / notes |
| --- | --- | --- | --- | --- |
| Auth + onboarding (Hyperverge) | ☐ | | | |
| Cert exam + retake payment | ☐ | | | |
| Appointments (directory, invite, inbox) | ☐ | | | |
| Sessions + lobby (LiveKit; guest Hyperverge gate) | ☐ | | | |
| QuickSign 4-step (DOCONCHAIN sandbox) | ☐ | | | |
| Registry + draft act + SC API sync | ☐ | | | |
| DM + Contract AI + admin dashboard | ☐ | | | |
| Public certificate verification | ☐ | | | |

**Sign-off:** ________________________  **Role:** ________________________  **Date:** ________________

---

## Launch criterion 2 — SC API sync in staging

**Requirement:** SC API sync succeeds end-to-end: commission check, consolidated submit, NRID/NRN persistence, PDF upload.

| Check | Verified | Notes |
| --- | --- | --- |
| Commission / eligibility | ☐ | |
| Consolidated submit | ☐ | |
| NRID/NRN persisted in DB | ☐ | |
| PDF upload accepted | ☐ | |

**Sign-off:** ________________________  **Role:** ________________________  **Date:** ________________

---

## Launch criterion 3 — DOCONCHAIN QuickSign in staging

**Requirement:** DOCONCHAIN QuickSign succeeds end-to-end: project creation, signer add, plotting, meeting creation, vault fetch, signed PDF retrieval.

| Step | Verified | Notes |
| --- | --- | --- |
| Project creation | ☐ | |
| Signer add | ☐ | |
| Plotting | ☐ | |
| Meeting creation | ☐ | |
| Vault fetch | ☐ | |
| Signed PDF retrieval | ☐ | |

**Sign-off:** ________________________  **Role:** ________________________  **Date:** ________________

---

## Launch criterion 4 — Security and privacy

**Requirement:** No critical or high-severity security or privacy findings remain open.

### Findings log

| ID | Severity | Area | Status (open / mitigated / closed) | Owner |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |

### Security / privacy verification (staging + config review)

| Topic | Verified | Notes |
| --- | --- | --- |
| PII at rest (RA 10173 alignment — infra + app minimization) | ☐ | |
| Webhook HMAC / signature verification (Hyperverge, payments, others) | ☐ | |
| Secrets only in secret managers / GitHub Environments — not in repo | ☐ | |
| CORS and cookie settings match deployed URLs | ☐ | |
| Rate limits appropriate for launch (see G1 runbook) | ☐ | |

**Security / privacy sign-off:** ________________________  **Role:** ________________________  **Date:** ________________

---

## Cutover automation acknowledgment

- [ ] Repository variable `AUTO_PROMOTE_STAGING_TO_PRODUCTION` is set to `true` only for the planned cutover window.
- [ ] Secret `PROMOTION_GITHUB_TOKEN` is configured and tested to push `production` (or documented exception with infra).
- [ ] Post-cutover: variable returned to `false` / removed after successful production verification.

**Engineering / infra sign-off:** ________________________  **Date:** ________________
