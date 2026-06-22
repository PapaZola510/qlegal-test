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

export async function loadEmailMfaStatus(): Promise<{ mfaVerified: boolean } | null> {
	const cookie = await getCookieHeader()
	if (!cookie.trim()) return null

	const base = nestApiBase()
	const version = env.NEXT_PUBLIC_API_VERSION.replace(/^\//, "")
	const url = `${base}/${version}/email/mfa/status`

	try {
		const res = await fetch(url, { headers: { cookie }, cache: "no-store" })
		if (!res.ok) return null
		return (await res.json()) as { mfaVerified: boolean }
	} catch {
		return null
	}
}
