import { createEnv } from "@t3-oss/env-core"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { createAuthMiddleware } from "better-auth/api"
import { openAPI } from "better-auth/plugins"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { createDBClient } from "@repo/db/client"
import { accounts, sessions, users, verifications } from "@repo/db/schema"

/**
 * Type-safe environment variable validation for Auth package
 *
 * Validates auth-related environment variables at module load time.
 * This ensures all required auth configuration is present before initialization.
 */
export const authEnv = createEnv({
	server: {
		// Authentication
		BETTER_AUTH_SECRET: z.string(),
		BETTER_AUTH_TRUSTED_ORIGINS: z.string(),
		BETTER_AUTH_COOKIE_DOMAIN: z.string().optional(),
		/**
		 * Public origin used for OAuth redirect_uri and auth URLs (must match the tab
		 * origin). In dev, default `http://localhost:3001` (Next.js; `/api` proxies to Nest).
		 * If this points at a different host/port than the browser, Google’s callback
		 * will not receive OAuth state cookies → `please_restart_the_process`.
		 */
		BETTER_AUTH_URL: z.string().url().optional(),

		// OAuth Providers (Google)
		GOOGLE_CLIENT_ID: z.string().optional(),
		GOOGLE_CLIENT_SECRET: z.string().optional(),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
})

/**
 * Public basePath used by Better Auth.
 *
 * This MUST match the URL prefix that Better Auth is mounted on as seen by
 * the browser, because Better Auth uses it to construct OAuth redirect URIs
 * (e.g. `${baseURL}${basePath}/callback/google`). If this is `/auth` while
 * the route is actually exposed at `/api/v1/auth`, Google sends the user
 * back to a 404.
 *
 * The backend's auth middleware normalizes any future versioned requests
 * (e.g. `/api/v2/auth/*`) to this canonical path before passing them to
 * Better Auth, so all versions share a single Better Auth instance.
 */
export const AUTH_BASE_PATH = "/api/v1/auth"

const DEV_DEFAULT_PUBLIC_ORIGIN = "http://localhost:3001"
const PLACEHOLDER_MARKERS = ["your-", "placeholder", "example", "change_me", "todo"] as const

function isMfaRequiredAuthPath(path?: string): boolean {
	if (!path) return false
	if (path === "/sign-in/email" || path === "/sign-up/email") return true

	// Social sign-in sessions are created during Better Auth's provider callback.
	return path === "/callback/google" || path.startsWith("/callback/")
}

function isPlaceholderValue(value: string): boolean {
	const normalized = value.trim().toLowerCase()
	return PLACEHOLDER_MARKERS.some(marker => normalized.includes(marker))
}

function resolveGoogleOAuthCredentials(): { clientId: string; clientSecret: string } | null {
	const clientId = authEnv.GOOGLE_CLIENT_ID?.trim()
	const clientSecret = authEnv.GOOGLE_CLIENT_SECRET?.trim()

	if (!clientId || !clientSecret) return null
	if (isPlaceholderValue(clientId) || isPlaceholderValue(clientSecret)) return null
	if (!clientId.endsWith(".apps.googleusercontent.com")) return null

	return { clientId, clientSecret }
}

function oauthStateCleanupPlugin() {
	return {
		id: "oauth-state-cleanup",
		hooks: {
			after: [
				{
					matcher(context: { path?: string }) {
						return context.path === "/sign-out"
					},
					handler: createAuthMiddleware(async ctx => {
						for (const cookieKey of ["state", "oauth_state"] as const) {
							const authCookie = ctx.context.createAuthCookie(cookieKey)
							ctx.setCookie(authCookie.name, "", {
								...authCookie.attributes,
								maxAge: 0,
							})
						}
					}),
				},
			],
		},
	}
}

function resolveBetterAuthBaseURL(): string | undefined {
	if (authEnv.BETTER_AUTH_URL) return authEnv.BETTER_AUTH_URL
	// Nest often runs without NODE_ENV in .env; treat unset as non-production so OAuth
	// redirect_uri targets Next (:3001), not the proxied Nest listener (:3000).
	const nodeEnv = process.env.NODE_ENV ?? "development"
	if (nodeEnv !== "production") return DEV_DEFAULT_PUBLIC_ORIGIN
	return undefined
}

/**
 * Creates a Better Auth instance configured with Drizzle adapter.
 *
 * The auth instance uses database connection from @repo/db and is
 * configured to work across multiple apps (backend, web, mobile via API).
 *
 * Uses a neutral basePath ("/auth") - the backend normalizes versioned
 * paths (/api/v1/auth/*, /api/v2/auth/*) to this basePath before handling.
 *
 * @returns Better Auth instance
 */
export function createAuth(): ReturnType<typeof betterAuth> {
	const db = createDBClient()

	const googleOAuthCredentials = resolveGoogleOAuthCredentials()

	const baseURL = resolveBetterAuthBaseURL()
	const useSecureCookies = baseURL?.startsWith("https://") ?? false

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: {
				users,
				sessions,
				accounts,
				verifications,
			},
			usePlural: true,
		}),
		...(baseURL ? { baseURL } : {}),
		basePath: AUTH_BASE_PATH,
		secret: authEnv.BETTER_AUTH_SECRET,
		databaseHooks: {
			user: {
				create: {
					before: async user => ({
						data: {
							...user,
							emailVerified: true,
						},
					}),
					after: async user => {
						if (user.emailVerified) return
						await db
							.update(users)
							.set({ emailVerified: true, updatedAt: new Date() })
							.where(eq(users.id, user.id))
					},
				},
			},
			session: {
				create: {
					after: async (session, context) => {
						if (!isMfaRequiredAuthPath(context?.path)) return
						const now = new Date()
						await db
							.update(sessions)
							.set({ mfaRequiredAt: now, mfaVerifiedAt: null, updatedAt: now })
							.where(eq(sessions.id, session.id))
					},
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		...(googleOAuthCredentials && {
			socialProviders: {
				google: {
					prompt: "select_account",
					clientId: googleOAuthCredentials.clientId,
					clientSecret: googleOAuthCredentials.clientSecret,
				},
			},
		}),
		trustedOrigins: authEnv.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [],
		advanced: {
			useSecureCookies,
			// IMPORTANT: our app calls non-auth API routes (e.g. /api/v1/email/*).
			// Ensure the Better Auth session cookie is sent for all /api/* routes.
			cookies: {
				session_token: {
					attributes: {
						path: "/",
					},
				},
			},
			...(authEnv.BETTER_AUTH_COOKIE_DOMAIN && {
				/**
				 * Only enable when web and API run on different subdomains of the same parent
				 * (e.g. app.example.com + api.example.com). On a single host (stg-qlegal…),
				 * omit BETTER_AUTH_COOKIE_DOMAIN to avoid duplicate/stale cookies on .quanbyai.com.
				 */
				crossSubDomainCookies: {
					enabled: true,
					domain: authEnv.BETTER_AUTH_COOKIE_DOMAIN,
				},
			}),
		},
		plugins: [
			oauthStateCleanupPlugin(),
			openAPI({
				path: "/reference",
			}),
		],
	})
}

/**
 * Default Better Auth instance.
 * This is the shared instance used across all apps.
 *
 * Lazy initialization to ensure environment variables are loaded before creating the instance.
 */
let _auth: ReturnType<typeof betterAuth> | null = null

/**
 * Clear the cached auth instance. Call this when configuration changes.
 */
export function clearAuthCache(): void {
	_auth = null
}

export function getAuth(): ReturnType<typeof betterAuth> {
	if (!_auth) {
		_auth = createAuth()
	}
	return _auth!
}

/**
 * Inferred Session type from Better Auth.
 * Export this so web app can use the correct types matching backend config.
 */
export type Session = ReturnType<typeof getAuth>["$Infer"]["Session"]
