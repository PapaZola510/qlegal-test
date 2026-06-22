import "server-only"

import type { UserProfile } from "@repo/contracts"

import { getCookieHeader } from "@/core/lib/cookie-utils"
import { env } from "@/env"

/**
 * Resolve Nest `/api` base URL for server-side fetches.
 * Prefer INTERNAL_API_BASE_URL (Docker). In local dev, call Nest directly via
 * BACKEND_PROXY_ORIGIN (same var next.config.ts uses for rewrites) so cookies
 * forwarded from the incoming Next request always reach Better Auth / oRPC,
 * and so devs running Nest on a non-default port are picked up automatically.
 */
function nestApiBase(): string {
	const internal = env.INTERNAL_API_BASE_URL?.replace(/\/$/, "")
	if (internal) return internal
	if (env.NODE_ENV === "development") {
		const proxyOrigin = env.BACKEND_PROXY_ORIGIN?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
		return `${proxyOrigin}/api`
	}
	return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
}

/**
 * Loads the current user profile on the server (RSC) using the browser Cookie header.
 * Avoids relying on cross-origin browser fetch from the client to Nest.
 */
export async function loadDashboardProfile(): Promise<UserProfile | null> {
	const cookie = await getCookieHeader()
	if (!cookie.trim()) return null

	const base = nestApiBase()
	const version = env.NEXT_PUBLIC_API_VERSION.replace(/^\//, "")
	const url = `${base}/${version}/profile/me`

	try {
		const res = await fetch(url, {
			headers: { cookie },
			cache: "no-store",
		})
		if (!res.ok) return null
		return (await res.json()) as UserProfile
	} catch {
		return null
	}
}
