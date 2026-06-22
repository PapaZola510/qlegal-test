import { Logger } from "@nestjs/common"

import { env } from "@/config/env.config"

const log = new Logger("LocationProxyCheck")

export interface ProxyCheckIpData {
	status?: "ok" | "error"
	proxy?: "yes" | "no"
	type?: string
	country?: string
	asn?: string
	provider?: string
	organisation?: string
	[extra: string]: unknown
}

interface ProxyCheckResponse {
	status?: string
	message?: string
	[ip: string]: ProxyCheckIpData | string | undefined
}

export interface VpnCheckResult {
	checked: boolean
	isVpn: boolean
	ipData: ProxyCheckIpData | null
	message?: string
}

/**
 * Authoritative VPN/proxy check via proxycheck.io.
 *
 * Without `PROXYCHECK_API_KEY` the check is skipped and `checked=false` is
 * returned. In production we additionally log a warning since the lobby gate
 * silently weakens to advisory-only signals from ip-api.com.
 */
export async function checkVpnStatus(ip: string): Promise<VpnCheckResult> {
	const key = env.PROXYCHECK_API_KEY?.trim()

	if (!key) {
		if (env.NODE_ENV === "production") {
			log.warn(
				"PROXYCHECK_API_KEY is not configured. VPN detection is disabled. " +
					"Set PROXYCHECK_API_KEY to enable hard blocking on confirmed VPN exits."
			)
		}
		return {
			checked: false,
			isVpn: false,
			ipData: null,
			message: "PROXYCHECK_API_KEY is not configured",
		}
	}

	try {
		const response = await fetch(`https://proxycheck.io/v2/${ip}?key=${key}&vpn=1`, {
			headers: { Accept: "application/json" },
		})

		if (!response.ok) {
			log.error(`proxycheck.io returned status ${response.status}`)
			return { checked: false, isVpn: false, ipData: null, message: "VPN check request failed" }
		}

		const data = (await response.json()) as ProxyCheckResponse
		const ipPayload = data[ip]

		if (!ipPayload || typeof ipPayload === "string") {
			log.error("proxycheck.io response missing IP payload")
			return { checked: false, isVpn: false, ipData: null, message: "Invalid VPN check response" }
		}

		if (ipPayload.status === "error") {
			log.error(`proxycheck.io error: ${data.message ?? "Unknown error"}`)
			return {
				checked: false,
				isVpn: false,
				ipData: null,
				message: data.message ?? "VPN check provider error",
			}
		}

		const isVpn = ipPayload.proxy === "yes"
		return { checked: true, isVpn, ipData: ipPayload }
	} catch (error) {
		log.error("Error checking VPN status", error)
		return { checked: false, isVpn: false, ipData: null, message: "VPN check error" }
	}
}
