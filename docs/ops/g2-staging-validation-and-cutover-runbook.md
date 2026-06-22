# G2 — Staging validation and cutover readiness (operations)

This runbook supports **Phase G — Cutover** for the Quanby Legal v2 → qlegal-new migration. It complements the Epic Brief launch success criteria and the formal sign-off artifact in `g2-launch-sign-off-checklist.md`.

## 1. Staging E2E scope (parity flows)

Execute end-to-end QA in **staging** (not localhost) for every in-scope flow. Track evidence (ticket IDs, screen recordings, API trace IDs) in the sign-off checklist.

| Area | What to validate (headline) |
| --- | --- |
| Auth + onboarding | Google OAuth via Better Auth; Hyperverge KYC path and webhook completion |
| Cert exam + retake | Exam attempt lifecycle; payment gateway webhook for retake; admin override if applicable |
| Appointments | Directory / find-a-notary; invite link; inbox or notification surface |
| Sessions + lobby | LiveKit room join; guest signer path with Hyperverge gate where required |
| QuickSign | Four-step flow against **DOCONCHAIN staging** (sandbox): project, signers, plotting, meeting, vault, signed PDF |
| Registry + SC sync | Commission check; consolidated submit; NRID/NRN persistence; PDF upload — **SC staging partner API** |
| DM + Contract AI + admin | Direct messages; Contract AI proxy; admin dashboard (sidebar) critical paths |
| Public cert verification | Public verification UI/API behaves per spec |

Automated CI coverage: `.github/workflows/ci.yml` runs lint, typecheck, unit tests, and Playwright E2E for the web app when relevant paths change. **Staging manual / scripted QA remains authoritative** for integrations (Hyperverge, payments, LiveKit, DOCONCHAIN, SC).

## 2. Integration dry-runs (launch blockers)

### 2.1 Supreme Court registry sync (staging)

Confirm in staging logs and partner tooling:

- Commission / eligibility check succeeds for a test ENP.
- Consolidated act submit succeeds with expected payload shape (facility number, roll number, principals, witnesses, metadata).
- NRID/NRN returned values persist in Postgres and round-trip in the app.
- PDF upload completes and is acknowledged by the partner API.

If sync fails: see **§4.1 SC sync failures**.

### 2.2 DOCONCHAIN QuickSign (staging)

Using DOCONCHAIN **staging** credentials (`apps/backend/.env.example` — `DOCONCHAIN_*`):

- Create project; add signers; plotting links; meeting creation; vault fetch; retrieve signed PDF.

If DOCONCHAIN is unavailable: see **§4.2 DOCONCHAIN outages**.

## 3. Security and privacy (RA 10173 and integrations)

Before sign-off, complete the **Security / privacy** section in `g2-launch-sign-off-checklist.md`. In code review and staging verification, explicitly confirm:

- **PII at rest**: database encryption at rest (infra); minimal retention; access limited by role.
- **Webhooks**: Hyperverge, payment gateway, and any third-party callbacks verify **HMAC or documented signature** (see `.env.example` headers and backend guards).
- **Secrets**: no secrets in repo; GitHub Environments `staging` / `production` hold deployment secrets; rotation procedure documented with infra.
- **CORS and cookies**: `CORS_ORIGINS`, `BETTER_AUTH_TRUSTED_ORIGINS`, and production cookie domain align with real web/API URLs only.
- **Rate limits**: G1 knobs documented in `apps/backend/docs/g1-hardening-runbook.md` — staging load spot-check where abuse matters (uploads, Contract AI, SC sync).

## 4. On-call playbooks

### 4.1 SC sync failures

1. **Stop bulk harm**: disable or lower concurrency for SC bulk jobs (env / feature flag if available); avoid repeated failed submits for the same act until payload is fixed.
2. **Classify**: HTTP 4xx (payload/auth) vs 5xx (partner). Capture request id, ENP id, act id, NRID/NRN state from DB.
3. **Communicate**: if production and legal reporting window is affected, notify compliance / product owner per internal incident process.
4. **Rollback app**: if a bad deploy caused regression, use **§5 Revert** to restore last known-good images; data fixes only via reviewed SQL or admin tools.

### 4.2 DOCONCHAIN outages

1. **User impact**: QuickSign and any session flows that call DOCONCHAIN may fail or degrade; surface clear errors in UI if not already.
2. **Retry**: safe GETs can be retried; POSTs that create resources require idempotency keys or “check existing project” paths — follow service-layer behavior.
3. **Vendor status**: check DOCONCHAIN status page / support channel.
4. **Rollback app**: if outage coincided with bad deploy, use **§5 Revert**; otherwise wait for vendor recovery.

## 5. Revert via existing automation (no manual server patching)

Preferred order:

1. **Git / CI revert**: revert the offending commit on `staging` or `production` and push; let **Deploy Staging** (`/.github/workflows/deploy-staging.yml`) or **Deploy Production** (`/.github/workflows/deploy-production.yml`) rebuild and roll out.
2. **Re-deploy previous image tag**: in an emergency, infra can set `IMAGE_TAG` / ECR tags to the last known-good SHA (documented in the deployment summary of the passing workflow run) and re-run the deploy workflow from GitHub Actions **workflow_dispatch**.

DNS and static infra are **out of scope** for this Epic; rollback is **application and container** level only.

## 6. Automated promotion: staging success → production

To satisfy **“cutover branch merged to staging triggers automated production deploy with no manual intervention”** once launch criteria are met:

1. Repository variable: set **`AUTO_PROMOTE_STAGING_TO_PRODUCTION`** to `true` (only for the cutover window).
2. Repository secret: **`PROMOTION_GITHUB_TOKEN`** — a fine-scoped PAT or GitHub App installation token with **`contents: write`** to push branch `production`. If `production` is protected, allow this token to bypass protection for that branch or use a ruleset exception documented with infra.
3. Merge your **cutover** work into **`staging`**. When **Deploy Staging** completes successfully, **Promote Staging to Production** (`.github/workflows/promote-staging-to-production.yml`) fast-forwards **`production`** to the same commit SHA and triggers **Deploy Production**.

After cutover: set **`AUTO_PROMOTE_STAGING_TO_PRODUCTION`** back to `false` (or remove it) so routine staging merges do not ship to production.

## 7. Production environment configuration (infra-owned)

Ensure GitHub Environment **`production`** (and staging) variables/secrets are populated and smoke-tested:

- Supreme Court registry: URL, API key, Cognito or auth material as required by partner.
- DOCONCHAIN: staging vs prod URLs and keys per environment.
- Hyperverge: app id/key, webhook secret, trusted redirect URLs.
- LiveKit: URL, API key/secret.
- Payment provider: keys and webhook signing secret.
- OpenAI / xAI (Contract AI): keys on AI service and Nest proxy token alignment.
- Supabase S3-compatible storage: endpoint, keys, bucket.
- Better Auth: `BETTER_AUTH_SECRET`, origins, production cookie domain.

Cross-check against `apps/backend/.env.example` and `apps/web` env templates / deployment docs.

## 8. References

- Epic Brief — Launch Success Criteria and cutover: migration program spec (Traycer epic `f6b8aa09-d419-405c-a1c1-5e5296fc4b19`).
- G1 hardening: `apps/backend/docs/g1-hardening-runbook.md`.
- Workflows: `.github/workflows/deploy-staging.yml`, `deploy-production.yml`, `promote-staging-to-production.yml`, `ci.yml`.
