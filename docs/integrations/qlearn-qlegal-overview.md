# QLearn in QLegal — short overview

QLegal connects **ENP onboarding** to **QLearn** so learners can open the certification course in QLearn, finish it there, and QLegal can read progress and mark onboarding complete when appropriate.

**SSO detail (HMAC vs one-time code):** [lms-sso-handshake-spec.md](./lms-sso-handshake-spec.md)

---

## End-to-end flow (QLearn contract — no enrollment step)

| Step | What happens | QLearn API (`qlearn-core.quanbyit.com`) | QLegal |
|------|----------------|------------------------------------------|--------|
| 1 | Register / mirror user | `POST /api/v1/integration/users/upsert` | `LmsClient.upsertUser`, background `lms-sync` |
| 2 | SSO login + open course | `POST /api/v1/integration/sso/create-code` → browser opens `redirectUrl` on **qlearn.quanbyit.com** | `startTraining` |
| 3 | Learner takes course | (QLearn UI) | — |
| 4 | Progress | `POST /api/v1/integration/progress/query` `{ id, classCode }` | `getProgress`, `syncCourseCompletion` |
| 5 | Certificate | `POST /api/v1/integration/certificates/query` `{ id, classCode }` | `getCertificate` |
| 5b | Download cert | `GET /api/v1/integration/certificates/:certificateNumber/download?classCode=…` | qLegal proxy: `GET /api/v1/integration/lms/training/certificate/download?download=1` (session auth → integration API key) |
| 6 | Reflect in QLegal | — | `syncCourseCompletion` → `courseCompletedAt` + certified (QLearn Final Quiz replaces the legacy in-app 50-question exam) |

**Legacy (removed on QLearn):** `POST /integration/course-enrollments` — QLegal skips when `LMS_INTEGRATION_ENROLLMENT_MODE=skip` (default).

### Step 2 — create-code request / response

**Request** (`POST https://qlearn-core.quanbyit.com/api/v1/integration/sso/create-code`):

```json
{
  "id": "qlegal-user-id",
  "email": "user@example.com",
  "redirectUri": "https://qlearn.quanbyit.com/student/courses/view?id=crs_0bc482f1ea0b0eafb95d",
  "classCode": "qlegal-12345"
}
```

**Response** → browser opens `redirectUrl` on **qlearn.quanbyit.com**:

```json
{
  "code": "one-time-code",
  "redirectUrl": "https://qlearn.quanbyit.com/sso/callback?code=one-time-code&classCode=qlegal-12345&redirect=https%3A%2F%2Fqlearn.quanbyit.com%2Fstudent%2Fcourses%2Fview%3Fid%3Dcrs_0bc482f1ea0b0eafb95d",
  "expiresAt": "2026-05-28T08:05:00.000Z",
  "expiresInSeconds": 90
}
```

**Env mapping:**

| Variable | Maps to |
|----------|---------|
| `LMS_INTEGRATION_BASE_URL` | `https://qlearn-core.quanbyit.com/api/v1` |
| `LMS_INTEGRATION_COURSE_URL` / `LMS_INTEGRATION_SSO_REDIRECT_URI` | create-code `redirectUri` |
| `LMS_INTEGRATION_DEFAULT_CLASS_CODE` | `classCode` (e.g. `qlegal-12345`) |
| `LMS_INTEGRATION_QLEGAL_RETURN_URI` | optional `returnTo` on QLegal-built redeem URLs |

---

## QLearn HTTP APIs

| Route | Method | Body / params |
|-------|--------|----------------|
| `/integration/users/upsert` | POST | `{ id, email, firstName, …, kycStatus, kycVerifiedAt? }` |
| `/integration/sso/create-code` | POST | `{ id, email, redirectUri, classCode }` |
| `/integration/progress/query` | POST | `{ id, classCode }` |
| `/integration/certificates/query` | POST | `{ id, classCode }` |
| `/integration/certificates/:certificateNumber/download` | GET | `?classCode=qlegal-12345` |

---

## QLegal oRPC routes

- `POST /integration/lms/training/start` — upsert + create-code → `redirectUrl`
- `POST /integration/lms/sync-account` — upsert only
- `GET /integration/lms/training/progress`
- `GET /integration/lms/training/certificate`
- `POST /integration/lms/training/sync-completion`

**Web:** `NEXT_PUBLIC_ENABLE_LMS_INTEGRATION=true`

---

## What QLearn must provide for auto-login

1. **Upsert** creates the learner (visible in user management).
2. **`/sso/callback` on qlearn.quanbyit.com** redeems `code`, sets session cookie, redirects to `redirect` (course). Without this, users land on `/login` even when create-code returns 200.
3. **First-time theme onboarding** must honor the `redirect` query param (and optional `courseId`) from the SSO handoff — after the learner picks a theme, send them to the course URL (e.g. `/student/courses/view?id=crs_…`), **not** the student dashboard. QLegal always sends:
   ```
   /sso/callback?code=…&classCode=…&redirect=https://qlearn.quanbyit.com/student/courses/view?id=crs_…&courseId=crs_…
   ```
4. **Progress / certificates** APIs return accurate data for sync.
