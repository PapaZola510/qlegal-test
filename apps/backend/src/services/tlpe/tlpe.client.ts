import { env } from "@/config/env.config"

/** Easy Payment Link URL from AltPayNet onboarding (required for TLPE payments). */
export function tlpePaymentLinkConfigured(): boolean {
	return Boolean(env.TLPE_PAYMENT_LINK_URL?.trim())
}

/** TLPE is ready when credentials, API URL, and Easy Payment Link URL are configured. */
export function tlpeConfigured(): boolean {
	return Boolean(
		env.TLPE_AUTHORIZATION?.trim() &&
			env.TLPE_SECRET?.trim() &&
			env.TLPE_API_URL?.trim() &&
			env.TLPE_PAYMENT_LINK_URL?.trim()
	)
}

/** True when using TLPE test API (test-api.tlpe.io). */
export function tlpeTestMode(): boolean {
	const url = env.TLPE_API_URL?.trim() ?? ""
	return url.includes("test-api") || url.includes("test.")
}

/** Local dev + TLPE test API: allow marking meeting payment succeeded without a real charge. */
export function tlpeDevTestSimulateEnabled(): boolean {
	return env.NODE_ENV === "development" && tlpeTestMode()
}

export function tlpeApiBaseUrl(): string {
	const raw = env.TLPE_API_URL?.trim() ?? ""
	if (!raw) throw new Error("TLPE_API_URL is not configured")
	return raw.replace(/\/$/, "")
}

export function tlpePaymentLinkUrl(): string {
	const raw = env.TLPE_PAYMENT_LINK_URL?.trim() ?? ""
	if (!raw) throw new Error("TLPE_PAYMENT_LINK_URL is not configured")
	return raw
}

export function tlpeAuthorizationHeader(): string {
	const auth = env.TLPE_AUTHORIZATION?.trim()
	if (!auth) throw new Error("TLPE_AUTHORIZATION is not configured")
	return auth
}

export function tlpeSecret(): string {
	const secret = env.TLPE_SECRET?.trim()
	if (!secret) throw new Error("TLPE_SECRET is not configured")
	return secret
}

export async function tlpeRequest<T>(
	path: string,
	options: RequestInit & { body?: string } = {}
): Promise<T> {
	const base = tlpeApiBaseUrl()
	const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`
	const response = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			"Authorization": tlpeAuthorizationHeader(),
			...(options.headers as Record<string, string> | undefined),
		},
	})

	if (!response.ok) {
		const errorText = await response.text()
		if (response.status === 401) {
			throw new Error(
				`TLPE rejected the request (401 Unauthorized on ${path}). Ask AltPayNet to whitelist your server egress IP and confirm the live Authorization token is active for this account.`
			)
		}
		throw new Error(`TLPE API error: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const text = await response.text()
	if (!text.trim()) return {} as T
	return JSON.parse(text) as T
}
