import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod/v4"

/**
 * Type-safe environment variable validation for Web App
 *
 * All environment variables are validated at build time to ensure the app
 * isn't built with invalid environment variables.
 */
export const env = createEnv({
	/**
	 * Shared variables - available on both client and server
	 */
	shared: {
		// Server Configuration
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	},

	/**
	 * Server-side environment variables
	 * These are only available on the server and will NOT be exposed to the client
	 */
	server: {
		INTERNAL_API_BASE_URL: z.url().optional(),
		/** Nest origin for Next dev rewrites + RSC server-to-server fetches (must match apps/backend PORT). */
		BACKEND_PROXY_ORIGIN: z.url().optional(),
		/** Staff password for onboarding manual-completion unlock (server-only). */
		ONBOARDING_MANUAL_UNLOCK_PASSWORD: z.string().min(1).optional(),
		/** Emergency maintenance-mode kill switch. Case-insensitive `"true"` locks non-admins to `/maintenance` regardless of the DB flag. */
		MAINTENANCE_MODE: z.string().optional(),
	},

	/**
	 * Client-side environment variables
	 * These are exposed to the browser. Prefix them with `NEXT_PUBLIC_`.
	 */
	client: {
		/** Google Maps (Static Map / JS) — browser key, HTTP referrer–restricted in Google Cloud. */
		NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
		// Public URLs
		NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3001"),
		NEXT_PUBLIC_TERMS_URL: z.url().optional(),
		NEXT_PUBLIC_PRIVACY_URL: z.url().optional(),
		/** Browser hits this origin + `/api` (Next dev proxies to Nest — see `next.config.ts` rewrites). */
		NEXT_PUBLIC_API_BASE_URL: z.url().default("http://localhost:3001/api"),
		/** Override Socket.IO base URL (no path). Dev default: same tab origin so `/socket.io` can proxy through Next. */
		NEXT_PUBLIC_WS_ORIGIN: z.url().optional(),
		NEXT_PUBLIC_API_VERSION: z.string().default("v1"),
		/** Shows “Dev: auto-pass exam” when backend `CERT_EXAM_DEV_ASSIST=true`. */
		NEXT_PUBLIC_CERT_EXAM_DEV_ASSIST: z.enum(["true", "false"]).optional(),
		/** When `"true"`, the lobby location dialog renders technical details (request ID, etc.). */
		NEXT_PUBLIC_LOCATION_VERIFICATION_DEBUG: z.enum(["true", "false"]).optional(),
		/** When `"true"`, ENP onboarding uses QLearn course handoff instead of inline read-through only. */
		NEXT_PUBLIC_ENABLE_LMS_INTEGRATION: z.enum(["true", "false"]).optional(),
		/** Max browser-reported GPS accuracy (metres) accepted by the session lobby UI gate. */
		NEXT_PUBLIC_SESSION_GPS_MAX_ACCURACY_M: z.coerce.number().positive().default(200),
	},

	/**
	 * Destructure all client variables from `process.env` to make sure they aren't
	 * tree-shaken away during the build process.
	 */
	runtimeEnv: {
		// Server Configuration
		NODE_ENV: process.env.NODE_ENV,
		INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
		BACKEND_PROXY_ORIGIN: process.env.BACKEND_PROXY_ORIGIN,
		ONBOARDING_MANUAL_UNLOCK_PASSWORD: process.env.ONBOARDING_MANUAL_UNLOCK_PASSWORD,
		MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,

		// Client-side variables
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_TERMS_URL: process.env.NEXT_PUBLIC_TERMS_URL,
		NEXT_PUBLIC_PRIVACY_URL: process.env.NEXT_PUBLIC_PRIVACY_URL,
		NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
		NEXT_PUBLIC_WS_ORIGIN: process.env.NEXT_PUBLIC_WS_ORIGIN,
		NEXT_PUBLIC_API_VERSION: process.env.NEXT_PUBLIC_API_VERSION,
		NEXT_PUBLIC_CERT_EXAM_DEV_ASSIST: process.env.NEXT_PUBLIC_CERT_EXAM_DEV_ASSIST,
		NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
		NEXT_PUBLIC_LOCATION_VERIFICATION_DEBUG: process.env.NEXT_PUBLIC_LOCATION_VERIFICATION_DEBUG,
		NEXT_PUBLIC_ENABLE_LMS_INTEGRATION: process.env.NEXT_PUBLIC_ENABLE_LMS_INTEGRATION,
		NEXT_PUBLIC_SESSION_GPS_MAX_ACCURACY_M: process.env.NEXT_PUBLIC_SESSION_GPS_MAX_ACCURACY_M,
	},

	/**
	 * Skip validation during CI or linting to prevent errors in non-build contexts
	 */
	skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
})
