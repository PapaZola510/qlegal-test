import { env } from "@/config/env.config"

export function hitpayConfigured(): boolean {
	return Boolean(env.HITPAY_API_KEY?.trim() && env.HITPAY_API_URL?.trim())
}

/** True when using HitPay sandbox API (QRPH hosted checkout often cannot complete payment). */
export function hitpaySandboxMode(): boolean {
	return env.HITPAY_API_URL?.includes("sandbox") ?? false
}

/** Local dev + HitPay sandbox: allow marking meeting payment succeeded without a real QRPH charge. */
export function hitpayDevSandboxTestEnabled(): boolean {
	return env.NODE_ENV === "development" && hitpaySandboxMode()
}

export function hitpayApiBaseUrl(): string {
	const raw = env.HITPAY_API_URL?.trim() ?? ""
	if (!raw) throw new Error("HITPAY_API_URL is not configured")
	const withoutTrailing = raw.replace(/\/$/, "")
	return withoutTrailing.endsWith("/v1") ? withoutTrailing : `${withoutTrailing}/v1`
}

export function hitpayHeaders(): Record<string, string> {
	const key = env.HITPAY_API_KEY?.trim()
	if (!key) throw new Error("HITPAY_API_KEY is not configured")
	return {
		"Content-Type": "application/json",
		"X-BUSINESS-API-KEY": key,
		"X-Requested-With": "XMLHttpRequest",
	}
}

export async function hitpayRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const url = `${hitpayApiBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
	const response = await fetch(url, {
		...options,
		headers: {
			...hitpayHeaders(),
			...(options.headers as Record<string, string> | undefined),
		},
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`HitPay API error: ${response.status} ${response.statusText} - ${errorText}`)
	}

	return (await response.json()) as T
}
