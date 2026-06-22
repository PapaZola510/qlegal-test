import type { Request } from "express"

import { normalizeIpv4, resolvePublicClientIpv4 } from "./client-ipv4"

export interface EffectiveClientIpResult {
	/** IP used for VPN / country checks. */
	ip: string | null
	headerIp: string | null
	browserIp: string | null
	/** Both header and browser public IPs are known and differ (VPN/proxy split path). */
	ipPathMismatch: boolean
}

/**
 * Extract the originating client IP from common proxy headers.
 *
 * Prefers the first **public** IPv4 in the chain so local Next.js/ngrok hops
 * (`127.0.0.1`, `::1`) do not mask the browser's real address.
 */
export function getLocationClientIp(req: Request): string | null {
	const headers = req.headers
	const candidates: string[] = []

	const cf = headers["cf-connecting-ip"]
	if (typeof cf === "string" && cf.trim()) candidates.push(cf)

	const real = headers["x-real-ip"]
	if (typeof real === "string" && real.trim()) candidates.push(real)

	const xff = headers["x-forwarded-for"]
	if (typeof xff === "string") {
		candidates.push(
			...xff
				.split(",")
				.map(ip => ip.trim())
				.filter(Boolean)
		)
	}

	if (typeof req.ip === "string" && req.ip.trim()) {
		candidates.push(req.ip)
	}

	const socketIp = req.socket?.remoteAddress
	if (socketIp) candidates.push(socketIp)

	const publicIp = resolvePublicClientIpv4(candidates)
	if (publicIp) return publicIp

	const fallback = candidates.map(normalizeIpv4).find(Boolean)
	return fallback ?? null
}

/**
 * Resolve the client IP for VPN checks.
 *
 * Local dev routes API calls through Next.js (`localhost:3001` → Nest), which
 * bypasses browser VPN tunnels — the server only sees `127.0.0.1`. The browser
 * reports its real egress IP via `browserPublicIp` (ipify / WebRTC) so VPN
 * detection still works.
 */
export function resolveEffectiveClientIp(
	req: Request,
	browserPublicIp?: string | null
): EffectiveClientIpResult {
	const rawHeader = getLocationClientIp(req)
	const headerIp = rawHeader ? normalizeIpv4(rawHeader) : null
	const headerPublic = headerIp && resolvePublicClientIpv4([headerIp]) ? headerIp : null

	const browserRaw = browserPublicIp?.trim() ? normalizeIpv4(browserPublicIp.trim()) : null
	const browserIp = browserRaw && resolvePublicClientIpv4([browserRaw]) ? browserRaw : null

	const ipPathMismatch = Boolean(headerPublic && browserIp && headerPublic !== browserIp)
	const ip = ipPathMismatch ? browserIp : (headerPublic ?? browserIp ?? headerIp)

	return { ip, headerIp: headerPublic ?? headerIp, browserIp, ipPathMismatch }
}
