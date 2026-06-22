import {
	isPublicRoutableIpv4,
	normalizeIpv4,
	scanWebRtcPublicIpv4,
} from "@/core/hooks/use-webrtc-leak-detection"

/**
 * Discover the browser's public IPv4 egress address.
 *
 * Uses an external ipify request (routes through VPN/proxy) with WebRTC STUN
 * fallback. Required because local dev API calls (`localhost:3001` → Nest) bypass
 * browser VPN tunnels — the server never sees the VPN exit IP otherwise.
 */
export async function discoverBrowserPublicIpv4(): Promise<string | null> {
	try {
		const controller = new AbortController()
		const timeoutId = window.setTimeout(() => controller.abort(), 5000)
		const response = await fetch("https://api64.ipify.org?format=json", {
			signal: controller.signal,
			cache: "no-store",
		})
		window.clearTimeout(timeoutId)

		if (response.ok) {
			const data = (await response.json()) as { ip?: string }
			if (data.ip) {
				const ip = normalizeIpv4(data.ip)
				if (isPublicRoutableIpv4(ip)) return ip
			}
		}
	} catch {
		// Fall through to WebRTC
	}

	return scanWebRtcPublicIpv4(3000)
}
