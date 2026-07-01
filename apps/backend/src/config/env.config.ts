import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/**
 * Type-safe environment variable validation for Backend API
 *
 * Validates at module load time (fail-fast). Access all env vars through this object.
 */
export const env = createEnv({
	server: {
		// Server
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
		PORT: z.coerce.number().int().positive().default(3000),
		CORS_ORIGINS: z.string(),

		/** Public web app origin for links in emails (defaults to BETTER_AUTH_URL). */
		PUBLIC_APP_URL: z.string().url().optional(),

		/** Footer links used in transactional emails. Mirror the web app's values. */
		NEXT_PUBLIC_TERMS_URL: z.string().url().optional(),
		NEXT_PUBLIC_PRIVACY_URL: z.string().url().optional(),

		// Database
		DATABASE_URL: z.string(),
		/** Separate PostgreSQL for Electronic Notarial Book backup (ENB mirror). Optional in dev. */
		ENB_BACKUP_DATABASE_URL: z.string().optional(),

		// Authentication
		BETTER_AUTH_SECRET: z.string(),
		BETTER_AUTH_TRUSTED_ORIGINS: z.string(),

		// OAuth (optional)
		GOOGLE_CLIENT_ID: z.string().optional(),
		GOOGLE_CLIENT_SECRET: z.string().optional(),

		// S3-compatible storage (Supabase Storage S3 API). Omit in development to use the local disk adapter.
		S3_ENDPOINT: z.string().url().optional(),
		S3_REGION: z.string().optional(),
		S3_ACCESS_KEY_ID: z.string().optional(),
		S3_SECRET_ACCESS_KEY: z.string().optional(),
		S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),
		/**
		 * Optional override for the local disk file-storage root directory used in dev
		 * when no S3 credentials are configured. Defaults to `<backend cwd>/.local-storage`.
		 */
		LOCAL_FILE_STORAGE_DIR: z.string().optional(),

		// Hyperverge (identity / KYC). Optional: without app id+key the start endpoint still creates DB rows but returns a null sdkToken for local-only flows.
		HYPERVERGE_APP_ID: z.string().optional(),
		HYPERVERGE_APP_KEY: z.string().optional(),
		/** IDV host for `/v2/auth/token` (e.g. https://ind.idv.hyperverge.co). If unset or not an idv host, primary defaults to India IDV. */
		HYPERVERGE_API_URL: z.string().url().optional(),
		HYPERVERGE_AUTH_BASE_URL: z.string().url().optional(),
		HYPERVERGE_WORKFLOW_ID: z.string().optional(),
		/** Selfie-only liveness workflow for session lobby (e.g. workflow_liveness). */
		HYPERVERGE_LIVENESS_WORKFLOW_ID: z.string().optional(),
		HYPERVERGE_WEB_SDK_VERSION: z.string().optional(),
		HYPERVERGE_WEBHOOK_SECRET: z.string().optional(),
		/** HTTP header carrying hex HMAC-SHA256(rawBody) using HYPERVERGE_WEBHOOK_SECRET */
		HYPERVERGE_WEBHOOK_SIGNATURE_HEADER: z.string().optional(),

		/** ENP identity verification validity window (days), aligned with quanby-legal `KYC_VERIFICATION_VALIDITY_DAYS`. */
		KYC_VERIFICATION_VALIDITY_DAYS: z.coerce.number().int().positive().default(14),

		/** HMAC-SHA256 hex of raw body; payment gateway webhook must match */
		PAYMENT_WEBHOOK_SECRET: z.string().optional(),

		/** HitPay (QRPH meeting payments). Sandbox: https://api.sandbox.hit-pay.com */
		HITPAY_API_KEY: z.string().optional(),
		HITPAY_API_URL: z.string().url().optional(),
		/** HMAC-SHA256 of raw JSON body; Hitpay-Signature header on webhooks */
		HITPAY_WEBHOOK_SALT: z.string().optional(),

		/** Meeting session payment: convenience fee on notarial subtotal (basis points; 500 = 5%). */
		MEETING_CONVENIENCE_FEE_BPS: z.coerce.number().int().nonnegative().default(500),
		/** VAT on notarial + convenience + processing (basis points; 1200 = 12%). */
		MEETING_VAT_BPS: z.coerce.number().int().nonnegative().default(1200),
		/** HitPay QRPH pass-through estimate (basis points; 100 = 1%). */
		MEETING_HITPAY_QRPH_FEE_BPS: z.coerce.number().int().nonnegative().default(100),
		/** Minimum HitPay QRPH fee in PHP when percent is lower. */
		MEETING_HITPAY_QRPH_FEE_MIN_PHP: z.coerce.number().int().nonnegative().default(20),

		/** Meeting session payments: hitpay (sandbox dev) or tlpe (AltPayNet production). */
		MEETING_PAYMENT_PROVIDER: z.enum(["hitpay", "tlpe"]).default("tlpe"),

		/** Certified true copy fee in PHP before convenience/VAT (online payments via AltPayNet). */
		CTC_FEE_PHP: z.coerce.number().int().positive().default(150),

		/** AltPayNet TLPE (Easy Payment Link). Test: https://test-api.tlpe.io */
		TLPE_AUTHORIZATION: z.string().optional(),
		TLPE_SECRET: z.string().optional(),
		TLPE_API_URL: z.string().url().optional(),
		/** Dynamic Easy Payment Link URL from AltPayNet (required for TLPE meeting/CTC payments). */
		TLPE_PAYMENT_LINK_URL: z.string().url().optional(),
		/** Optional payment option code from GET /options (e.g. QRPH brand JWT) */
		TLPE_PAYMENT_OPTION_CODE: z.string().optional(),
		/** Optional redirect after payment on hosted link */
		TLPE_CALLBACK_URL: z.string().url().optional(),
		/** Optional Resend transactional email */
		RESEND_API_KEY: z.string().optional(),
		RESEND_FROM_EMAIL: z.string().min(3).optional(),

		/** Gmail / SMTP (used when RESEND_API_KEY is unset) */
		EMAIL_HOST: z.string().optional(),
		EMAIL_PORT: z.coerce.number().int().positive().optional(),
		EMAIL_USER: z.string().optional(),
		EMAIL_PASS: z.string().optional(),
		/** Alias used in some .env files */
		EMAIL_PASSWORD: z.string().optional(),
		EMAIL_FROM: z.string().optional(),
		EMAIL_FROM_NAME: z.string().optional(),

		/** Minutes before scheduled_at when a confirmed appointment becomes joinable (E4) */
		APPOINTMENT_SESSION_LEAD_MINUTES: z.coerce
			.number()
			.int()
			.min(0)
			.max(24 * 60)
			.default(15),

		/** LiveKit (E5). Optional in CI/local; join-token returns SERVICE_UNAVAILABLE when unset. */
		LIVEKIT_URL: z.string().url().optional(),
		LIVEKIT_API_KEY: z.string().optional(),
		LIVEKIT_API_SECRET: z.string().optional(),
		/** Optional LiveKit Egress S3 override. Defaults to S3_* settings and qlegal-sessions bucket. */
		LIVEKIT_EGRESS_S3_BUCKET: z.string().optional(),
		LIVEKIT_EGRESS_S3_REGION: z.string().optional(),
		LIVEKIT_EGRESS_S3_ENDPOINT: z.string().url().optional(),
		LIVEKIT_EGRESS_S3_ACCESS_KEY_ID: z.string().optional(),
		LIVEKIT_EGRESS_S3_SECRET_ACCESS_KEY: z.string().optional(),
		LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),
		LIVEKIT_EGRESS_S3_PREFIX: z.string().optional(),

		/**
		 * When `true` and NODE_ENV is `development`, skip ENP/client identity gates before joining LiveKit (local only).
		 * Does not bypass auth; never enable in staging/production traffic.
		 */
		SESSION_DEV_RELAX_IDENTITY: z.enum(["true", "false"]).optional(),

		/**
		 * When `true` and NODE_ENV is `development`, skip the *client* Hyperverge success requirement before joining.
		 * ENP identity checks remain enforced.
		 * Only intended for local testing.
		 */
		SESSION_DEV_RELAX_CLIENT_HYPERVERGE: z.enum(["true", "false"]).optional(),

		/** Supreme Court eNotarization API (E7). Optional: sync returns stub NRID when unset. */
		SUPREME_COURT_API_URL: z.string().url().optional(),
		SUPREME_COURT_AUTH_URL: z.string().url().optional(),
		SUPREME_COURT_CLIENT_ID: z.string().optional(),
		SUPREME_COURT_USERNAME: z.string().optional(),
		SUPREME_COURT_PASSWORD: z.string().optional(),
		/** Notary Facility Number (NFN-...) assigned by SC. */
		SUPREME_COURT_NFN: z.string().optional(),

		/** Python Contract AI (E9). When unset, Contract AI uses in-process fixtures (C1-style mocks). */
		AI_SERVICE_BASE_URL: z.string().url().optional(),
		/** Shared secret: Nest -> Python `X-Internal-Token`, and Python -> Nest resolve callback. */
		CONTRACT_AI_INTERNAL_TOKEN: z.string().optional(),
		/**
		 * Base URL the AI container uses to reach this API for `resolve-download` (e.g. http://host.docker.internal:3000).
		 * Defaults to http://127.0.0.1:{PORT} when unset.
		 */
		INTERNAL_API_BASE_URL: z.string().url().optional(),
		/** TTL for presigned GET URLs returned to the AI service (seconds). */
		CONTRACT_AI_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(120),

		/** G1: Contract AI -- max calls per user per window (in-process). */
		CONTRACT_AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
		CONTRACT_AI_RATE_LIMIT_WINDOW_MS: z.coerce
			.number()
			.int()
			.min(60_000)
			.max(24 * 60 * 60_000)
			.default(60 * 60_000),

		/** G1: POST /verify/document -- max requests per client IP per minute. */
		VERIFY_DOCUMENT_RATE_LIMIT_PER_IP: z.coerce.number().int().min(1).max(1000).default(20),

		/** G1: Registry bulk SC sync -- max requests per ENP per window. */
		REGISTRY_SC_SYNC_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
		REGISTRY_SC_SYNC_RATE_LIMIT_WINDOW_MS: z.coerce
			.number()
			.int()
			.min(60_000)
			.max(24 * 60 * 60_000)
			.default(60 * 60_000),

		/** HMAC key for compliance export manifests; required in production. */
		COMPLIANCE_EXPORT_SIGNING_KEY: z
			.string()
			.optional()
			.refine(value => process.env.NODE_ENV !== "production" || Boolean(value?.trim()), {
				message: "COMPLIANCE_EXPORT_SIGNING_KEY is required in production",
			}),

		/** G1: Multipart file uploads -- max per authenticated user per window. */
		FILE_UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
		FILE_UPLOAD_RATE_LIMIT_WINDOW_MS: z.coerce
			.number()
			.int()
			.min(60_000)
			.max(24 * 60 * 60_000)
			.default(60 * 60_000),

		/** G1: Cancel payment_intents stuck in pending longer than this (cron, minutes). */
		PAYMENT_INTENT_PENDING_MAX_AGE_MINUTES: z.coerce
			.number()
			.int()
			.min(5)
			.max(30 * 24 * 60)
			.default(24 * 60),

		/** When `true`, enables POST /cert-exam/dev-perfect for automated perfect exam submission (local/staging only). */
		CERT_EXAM_DEV_ASSIST: z.enum(["true", "false"]).optional(),

		/**
		 * Location verification (lobby gate). Reverse-geocodes the caller's coordinates via Google Maps
		 * and cross-checks the originating IP via ip-api.com + proxycheck.io. Required in production for
		 * the session lobby `Enter encrypted meeting` button to unlock.
		 */
		GOOGLE_MAPS_API_KEY: z.string().optional(),
		/** Optional. Without it, VPN detection falls back to ip-api advisory signals only (warned in prod). */
		PROXYCHECK_API_KEY: z.string().optional(),
		/** When `true`, location dialogs surface technical detail bodies (`requestId`, status codes, etc). */
		LOCATION_VERIFICATION_DEBUG: z.enum(["true", "false"]).optional(),
		/**
		 * When `true` and NODE_ENV is `development`, skip the lobby location gate at the join-token mint
		 * step (UI gate still runs). Only intended for local testing on machines without GPS.
		 */
		SESSION_DEV_RELAX_LOCATION: z.enum(["true", "false"]).optional(),
		/** Max age (minutes) of a successful `session_location_verify` audit row to satisfy the token gate. */
		SESSION_LOCATION_TOKEN_TTL_MIN: z.coerce.number().int().min(1).max(120).default(5),
		/** ISO-2 country code the lobby requires (defaults to PH). */
		SESSION_REQUIRE_COUNTRY: z.string().length(2).default("PH"),
		/** Legacy embassy radius (km); unused while lobby verification is PH-only. */
		SESSION_EMBASSY_RADIUS_KM: z.coerce.number().positive().default(1),
		/** Max GPS accuracy (metres) accepted before the lobby returns `gps_accuracy_low`. */
		SESSION_GPS_MAX_ACCURACY_M: z.coerce.number().positive().default(200),

		/**
		 * QLearn LMS ENP integration. QLegal calls QLearn's `/integration/*` APIs.
		 */
		/** e.g. `https://qlearn-core.quanbyit.com/api/v1` */
		LMS_INTEGRATION_BASE_URL: z.string().url().optional(),
		LMS_INTEGRATION_API_KEY: z.string().optional(),
		/** Where the learner lands on QLearn after SSO (student course view). */
		LMS_INTEGRATION_COURSE_URL: z.string().url().optional(),
		/**
		 * `redirectUri` for `POST /integration/sso/create-code`.
		 * Defaults to `LMS_INTEGRATION_COURSE_URL` when unset.
		 */
		LMS_INTEGRATION_SSO_REDIRECT_URI: z.string().url().optional(),
		/** QLegal `returnTo` after QLearn SSO; default `{PUBLIC_APP_URL}/sso/callback`. */
		LMS_INTEGRATION_QLEGAL_RETURN_URI: z.string().url().optional(),
		LMS_INTEGRATION_SSO_HANDOFF_MODE: z.enum(["create_code", "hmac"]).default("create_code"),
		LMS_INTEGRATION_SSO_REDEEM_URL: z.string().url().optional(),
		LMS_INTEGRATION_SSO_HMAC_FALLBACK: z.enum(["true", "false"]).optional(),
		LMS_INTEGRATION_SHARED_SECRET: z.string().optional(),
		LMS_INTEGRATION_DEFAULT_CLASS_CODE: z.string().optional(),
		LMS_INTEGRATION_DEFAULT_COURSE_ID: z.string().optional(),
		/** `skip` (default): upsert + create-code only; `required`: also call course-enrollments. */
		LMS_INTEGRATION_ENROLLMENT_MODE: z.enum(["required", "skip"]).default("skip"),
		LMS_INTEGRATION_DEMO_EMAIL: z.string().email().optional(),
		LMS_INTEGRATION_DEMO_PASSWORD: z.string().optional(),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
})

export function publicAppUrl(): string {
	const explicit = env.PUBLIC_APP_URL?.trim()
	if (explicit) return explicit.replace(/\/$/, "")
	const auth = process.env.BETTER_AUTH_URL?.trim()
	if (auth) return auth.replace(/\/$/, "")
	return "http://localhost:3001"
}

/** Terms of Service URL for email footers; falls back to `{PUBLIC_APP_URL}/terms`. */
export function termsUrl(): string {
	return env.NEXT_PUBLIC_TERMS_URL?.trim() || `${publicAppUrl()}/terms`
}

/** Privacy Policy URL for email footers; falls back to `{PUBLIC_APP_URL}/privacy`. */
export function privacyPolicyUrl(): string {
	return env.NEXT_PUBLIC_PRIVACY_URL?.trim() || `${publicAppUrl()}/privacy`
}

export type Env = typeof env
