# QLegal ↔ QLearn SSO Handshake Spec

**Owner:** QLegal team
**Audience:** QLearn (Rob and anyone implementing the receiving end)
**Status:** Proposal — replaces draft §3 (DB-backed one-time codes)
**Last updated:** 2026-05-27

---

## TL;DR

QLegal needs to drop an ENP user directly into a QLearn course after onboarding, without
asking them to log in to QLearn. The draft's §3 (one-time DB-backed code) works but is
heavier than necessary. **This spec proposes a stateless, HMAC-signed token approach
instead** — same security properties, fewer moving parts, ~40 lines of code on QLearn side.

---

## Flow (end-to-end)

```
┌────────────────┐                  ┌─────────────────────┐                 ┌──────────────┐
│ ENP (browser)  │                  │ QLegal backend      │                 │ QLearn       │
└────────┬───────┘                  └──────────┬──────────┘                 └──────┬───────┘
         │                                     │                                   │
         │  click "Start training in QLearn"   │                                   │
         │────────────────────────────────────►│                                   │
         │                                     │                                   │
         │                                     │  POST /integration/users/upsert   │
         │                                     │──────────────────────────────────►│
         │                                     │  ◄────────────── { lmsUserId }    │
         │                                     │                                   │
         │                                     │  POST /integration/course-        │
         │                                     │       enrollments                 │
         │                                     │──────────────────────────────────►│
         │                                     │  ◄─────── { classId, courseId }   │
         │                                     │                                   │
         │                                     │  generate HMAC token (local)      │
         │                                     │  no network call needed           │
         │                                     │                                   │
         │  302 → https://qlearn.../course?    │                                   │
         │       email=...&exp=...&sig=...     │                                   │
         │◄────────────────────────────────────│                                   │
         │                                     │                                   │
         │  GET /course?email=...&exp=...&sig=...                                  │
         │────────────────────────────────────────────────────────────────────────►│
         │                                     │                                   │
         │                                     │  /sso/auto middleware:            │
         │                                     │   1. verify HMAC(email:exp)       │
         │                                     │   2. check exp > now              │
         │                                     │   3. find user by email           │
         │                                     │   4. mint QLearn session cookie   │
         │                                     │                                   │
         │  ◄── Set-Cookie + 302 → /course (no SSO params)                         │
         │                                                                         │
         │  GET /course (session cookie attached → renders course content)         │
         │────────────────────────────────────────────────────────────────────────►│
         │                                                                         │
```

---

## What QLegal already does (no QLearn-side dependency)

1. **Calls `POST /integration/users/upsert`** (draft §1) — creates the QLearn account if needed.
   The account is **passwordless by design**; the only way in is via this SSO handshake.
2. **Calls `POST /integration/course-enrollments`** (draft §2) — enrolls user in the class.
3. **Generates the redirect URL with HMAC token** (local, no network):
   ```
   https://qlearn.quanbyit.com/<configured-course-url>?email=<user>&exp=<unix-s>&sig=<hex>&class=<classCode>
   ```
4. **Browser redirects to that URL.**

Set **`LMS_INTEGRATION_SSO_HANDOFF_MODE=hmac`** in QLegal (default). Use `create_code` only if QLearn still requires draft §3.

When `hmac` + live `LMS_INTEGRATION_BASE_URL`, also set **`LMS_INTEGRATION_COURSE_URL`** (QLearn landing page) and **`LMS_INTEGRATION_SHARED_SECRET`** (same secret as QLearn `QLEGAL_SSO_SHARED_SECRET`).

With **`hmac`**, QLegal does **not** call **`POST /integration/sso/create-code`** — that §3 endpoint is unnecessary for this scheme.

---

## What QLearn needs to build

A **single middleware** (or controller) that sits in front of any URL that requires a
session (or, simpler, a dedicated `GET /sso/auto` route). When it sees the three SSO
query params, it verifies them and mints a session.

### Endpoint contract

| | |
|---|---|
| **Method** | `GET` |
| **Path** | Either: (a) middleware on all auth-guarded routes that reads the params, OR (b) dedicated `GET /sso/auto?redirect=…` route that 302s after auth. |
| **Query params** | `email`, `exp`, `sig`, `class` |
| **Headers needed** | None |
| **Auth required** | None (the signature IS the auth) |

### Verification logic (Node.js example — adapt to QLearn's stack)

```ts
import { createHmac } from "node:crypto"

const SECRET = process.env.QLEGAL_SSO_SHARED_SECRET // must match QLegal's LMS_INTEGRATION_SHARED_SECRET

export async function ssoAutoLogin(req, res, next) {
  const { email, exp, sig, class: classCode } = req.query

  // No SSO params present → normal request, continue
  if (!email || !exp || !sig) return next()

  // 1. Verify signature
  const expected = createHmac("sha256", SECRET).update(`${email}:${exp}`).digest("hex")
  if (sig !== expected) {
    return res.status(401).send("Invalid SSO signature")
  }

  // 2. Verify expiry
  if (Number(exp) < Math.floor(Date.now() / 1000)) {
    return res.status(401).send("SSO token expired")
  }

  // 3. Look up user by email
  let user = await db.users.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).send("User not provisioned — call /integration/users/upsert first")
  }

  // 4. Optional: log audit event
  await db.integrationAuditLog.create({
    data: {
      action: "sso.auto_login",
      externalUserId: user.id,
      classCode: classCode ?? null,
      status: "success",
    },
  })

  // 5. Mint QLearn session cookie (use your normal auth lib)
  await loginAs(req, res, user)

  // 6. 302 to the same URL with SSO params stripped (cleanup)
  const cleanUrl = new URL(req.url, "https://qlearn.quanbyit.com")
  for (const p of ["email", "exp", "sig", "class"]) cleanUrl.searchParams.delete(p)
  return res.redirect(cleanUrl.toString())
}
```

### Acceptance criteria

- [ ] `sig` matches `HMAC_SHA256(SHARED_SECRET, email + ":" + exp)` → continue, else 401
- [ ] `exp` > current unix-seconds → continue, else 401
- [ ] User with `email` exists → log them in, else 404 (don't auto-provision here; that's
      what §1 upsert is for and it must happen first)
- [ ] Mints standard QLearn session cookie (same cookie name/flags as normal login)
- [ ] Redirects to the request URL with SSO params stripped (clean browser bar)
- [ ] Wrong/expired/missing-user cases return clear error messages, not 500s

---

## Companion requirement: preserve course redirect after theme onboarding

**Problem:** SSO auto-login works, but first-time learners hit QLearn's theme picker and are
sent to the **student dashboard** instead of the course URL QLegal passed in `redirect`.

**Expected flow:**

1. Browser opens `/sso/callback?code=…&redirect=/student/courses/view?id=crs_…&courseId=crs_…`
2. QLearn redeems the code, stores `redirect` (and `courseId`) in session
3. If theme onboarding is required, show it — then **302 to the stored `redirect` URL**, not `/dashboard`
4. Enrolled learners should land directly on the course view

**Acceptance criteria:**

- [ ] After theme onboarding completes, user lands on the SSO `redirect` URL (course view)
- [ ] When `courseId` is present and the user is enrolled in that class, QLearn may resolve the
      course URL even if `redirect` was lost (defensive fallback)
- [ ] Repeat SSO visits (theme already done) skip onboarding and open the course immediately

---

## Security properties

| Concern | How this scheme handles it |
|---|---|
| **Replay attack** | `exp` is short (120s) — by the time a leaked URL is used, token is invalid |
| **Tampering** | HMAC verifies email wasn't modified |
| **Credential theft** | No password ever sent. Compromise of the shared secret = forge any token, but doesn't expose past sessions (HMAC isn't encryption) |
| **Secret rotation** | Both sides update `QLEGAL_SSO_SHARED_SECRET` simultaneously. ~5-min window of in-flight tokens may fail; acceptable. |
| **Phishing** | URL contains user's email and an expiring sig — knowing the URL is not enough; you need an in-time valid sig generated by QLegal |
| **Logging** | Email is visible in logs (intentional — useful for ops). Sig is also logged but is single-use within 120s — useless after expiry |

---

## Environment variables

### On QLegal (already set)

```bash
LMS_INTEGRATION_SHARED_SECRET=<32-byte-hex>     # generate: openssl rand -hex 32
LMS_INTEGRATION_COURSE_URL=https://qlearn.quanbyit.com/...  # where to drop the learner
```

### On QLearn (please add)

```bash
QLEGAL_SSO_SHARED_SECRET=<same-32-byte-hex>     # MUST equal QLegal's value
```

**Production secret coordination:** generate one secret per environment (dev/staging/prod),
store in both sides' secret managers (AWS Secrets Manager, 1Password, etc.). Rotate every
~6 months or after any suspected leak.

---

## Test cases (please cover before shipping)

| Case | Input | Expected |
|---|---|---|
| Happy path | Valid email, exp=now+60, correct sig | Session set, 302 to course |
| Tampered email | Valid sig but email changed to other@example.com | 401 |
| Expired | Valid sig, exp=now-10 | 401 |
| Bad sig | Wrong characters | 401 |
| Missing user | Valid sig, email never upserted | 404 |
| No SSO params | Plain GET /course | Middleware skips, normal flow |
| Replay after expiry | Same URL hit twice with gap > 120s | Second request 401 |

---

## Why not draft §3 (one-time DB-backed code)?

Both achieve the same goal. The draft's §3 needs:
- A new `integration_sso_code` table
- HTTP round-trip per redirect (QLegal → QLearn create-code → QLegal → browser → QLearn redeem)
- Storage cleanup cron for expired codes
- Audit log writes on consumption
- Race-condition handling on code consumption

HMAC token needs:
- A shared env var
- Pure crypto, no DB
- One round-trip total (QLegal generates URL → browser → QLearn verifies)

Same security model (short-lived, single-use-in-practice, signed). 80% less work.

---

## Companion requirement: skip `/first-login` for QLegal-verified users

**Problem we just hit:** even after a successful login (manual or SSO), the learner lands on
`https://qlearn.quanbyit.com/first-login` and is asked to upload a government ID front+back
before the course will render. This is a per-account gate that fires on first login.

For QLegal-originated learners this is duplicate work: **QLegal already runs Hyperverge KYC
during onboarding** and only ever calls `users/upsert` for users with verified identity.

### Proposed contract change

When `POST /integration/users/upsert` (draft §1) arrives with both of these set:

```json
{
  "kycStatus": "VERIFIED",
  "kycVerifiedAt": "2026-05-15T03:22:11.000Z"
}
```

QLearn should treat KYC as already complete for that account and **skip the `/first-login`
gate** — landing the user directly on the dashboard / course.

### Optional fields QLegal can add (we have the data, format TBD)

For audit / admin-review on QLearn's side. We'll wire these once QLearn confirms what they want:

| Field | Description | Source on QLegal |
|---|---|---|
| `kycProvider` | Always `"hyperverge"` for now | constant |
| `kycProviderTxnId` | Hyperverge transaction id | `hyperverge_transactions.hv_transaction_id` |
| `kycIdImageUrl` | Signed S3 URL (24h TTL) of the government ID photo | `file_objects.s3_key` via Hyperverge txn |
| `kycSelfieUrl` | Signed S3 URL (24h TTL) of the liveness selfie | `file_objects.s3_key` via Hyperverge txn |

Tell us: do you want URLs (we sign + you fetch within 24h) or base64 blobs (heavier payload,
no expiry concern)? Either works on our side.

### Acceptance criteria

- [ ] User upserted with `kycStatus="VERIFIED"` + non-null `kycVerifiedAt` → `/first-login`
      gate is bypassed on next login
- [ ] User upserted with `kycStatus="PENDING"` or `"UNVERIFIED"` → `/first-login` gate still
      fires (preserves QLearn's default behavior for non-QLegal users)
- [ ] Admin UI on QLearn still shows the ID images if we send them, for compliance review

---

## Questions for the QLearn team

1. **Where should the SSO middleware live?** Global middleware on all routes, or dedicated `/sso/auto` route? (Either works for us.)
2. **What's the canonical "student view course" URL pattern?** Today we're pointing at `/teacher/courses/view?id=…` which is wrong for learners. Need the equivalent learner route.
3. **Will you honor `kycStatus=VERIFIED` from upsert to skip `/first-login`?** (See "Companion requirement" above.) Without this, QLegal users hit a duplicate KYC step.
4. **What format do you want the ID/selfie images in** — signed URLs we generate, or base64 in the upsert payload?
5. **Do you want us to send any additional context** beyond `email + exp + sig + class` on the SSO redirect? E.g. learner's full name, role marker?
6. **Timeline?** ~40 lines for SSO + ~5 lines for the KYC bypass on your side, ideally this sprint.

---

## Contact

QLegal side: see `apps/backend/src/services/lms/lms.client.ts` (`createSsoCode`)
QLearn side: TBD (Rob's call on where this lives in your codebase)
