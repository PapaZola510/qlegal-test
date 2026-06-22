import { cache } from "react"

import { type AuthSession } from "@repo/auth"

import { hasLikelyAuthSessionCookie } from "@/core/lib/auth-session-cookie"
import { getCookieHeader } from "@/core/lib/cookie-utils"
import { getServerAuthUrl } from "@/core/lib/server-utils"

const SESSION_RETRY_ATTEMPTS = 10
const SESSION_RETRY_DELAY_MS = 400

export type ProtectedSessionResult =
	| { kind: "authenticated"; session: AuthSession }
	| { kind: "unauthenticated" }
	/** Auth cookie present but API was unreachable (common while `pnpm dev` restarts). */
	| { kind: "recoverable" }

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableSessionResponse(status: number): boolean {
	return status === 425 || status === 429 || status >= 500
}

function parseSessionPayload(data: unknown): AuthSession | null {
	if (!data || typeof data !== "object") return null
	const record = data as Record<string, unknown>
	if (record.session === null) return null
	if (record.user && typeof record.user === "object") {
		return data as AuthSession
	}
	return null
}

async function fetchSessionOnce(cookieHeader: string): Promise<AuthSession | null | "retry"> {
	try {
		const response = await fetch(`${getServerAuthUrl()}/get-session`, {
			headers: {
				"Content-Type": "application/json",
				"cookie": cookieHeader,
			},
			cache: "no-store",
		})

		if (response.status === 401 || response.status === 403) {
			return null
		}

		if (!response.ok) {
			return isRetryableSessionResponse(response.status) ? "retry" : null
		}

		const data: unknown = await response.json().catch(() => null)
		return parseSessionPayload(data)
	} catch {
		return "retry"
	}
}

async function fetchSessionWithRetry(cookieHeader: string): Promise<AuthSession | null> {
	for (let attempt = 1; attempt <= SESSION_RETRY_ATTEMPTS; attempt++) {
		const result = await fetchSessionOnce(cookieHeader)
		if (result !== "retry") {
			return result
		}
		if (attempt < SESSION_RETRY_ATTEMPTS) {
			await sleep(SESSION_RETRY_DELAY_MS)
		}
	}
	return null
}

/**
 * Get current user session from backend.
 *
 * Retries while Nest is restarting so a transient outage does not look like a logout.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
	const cookieHeader = await getCookieHeader()
	if (!cookieHeader.trim()) {
		return null
	}
	return fetchSessionWithRetry(cookieHeader)
})

/**
 * For protected layouts: distinguish logout vs dev/API restart with cookies still present.
 */
export const resolveProtectedSession = cache(async (): Promise<ProtectedSessionResult> => {
	const cookieHeader = await getCookieHeader()
	if (!hasLikelyAuthSessionCookie(cookieHeader)) {
		return { kind: "unauthenticated" }
	}

	const session = await fetchSessionWithRetry(cookieHeader)
	if (session) {
		return { kind: "authenticated", session }
	}

	return { kind: "recoverable" }
})
