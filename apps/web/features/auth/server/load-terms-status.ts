import "server-only"

import { getCookieHeader } from "@/core/lib/cookie-utils"
import { env } from "@/env"

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
 * Returns `true` when the user has accepted T&C, `false` when they haven't,
 * and `null` when the profile could not be fetched (e.g. backend unreachable).
 */
export async function loadTermsStatus(): Promise<boolean | null> {
	const cookie = await getCookieHeader()
	if (!cookie.trim()) return null

	const base = nestApiBase()
	const version = env.NEXT_PUBLIC_API_VERSION.replace(/^\//, "")
	const url = `${base}/${version}/profile/me`

	try {
		const res = await fetch(url, { headers: { cookie }, cache: "no-store" })
		if (!res.ok) return null
		const profile = (await res.json()) as { termsAcceptedAt?: string | null }
		return Boolean(profile.termsAcceptedAt)
	} catch {
		return null
	}
}
