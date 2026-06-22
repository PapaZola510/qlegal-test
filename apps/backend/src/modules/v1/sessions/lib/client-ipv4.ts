/** Strip IPv4-mapped IPv6 prefix (`::ffff:203.0.113.1` → `203.0.113.1`). */
export function normalizeIpv4(ip: string): string {
	const trimmed = ip.trim()
	return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed
}

/**
 * True for globally routable IPv4 addresses (excludes RFC1918, loopback, etc.).
 * Mirrors the WebRTC hook filter so HTTP and STUN comparisons stay aligned.
 */
export function isPublicRoutableIpv4(ip: string): boolean {
	const normalized = normalizeIpv4(ip)
	const octets = normalized.split(".")
	if (octets.length !== 4) return false

	const nums = octets.map((octet): number | null => {
		if (!/^(0|[1-9]\d{0,2})$/.test(octet)) return null
		const parsed = Number(octet)
		return parsed <= 255 ? parsed : null
	})

	if (nums.some(octet => octet === null)) return false

	const [a, b, c] = nums as [number, number, number, number]

	return !(
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0 && c === 0) ||
		(a === 192 && b === 0 && c === 2) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113)
	)
}

/** Pick the first public IPv4 from proxy header candidates (left-to-right). */
export function resolvePublicClientIpv4(candidates: Iterable<string>): string | null {
	for (const raw of candidates) {
		const ip = normalizeIpv4(raw)
		if (isPublicRoutableIpv4(ip)) return ip
	}
	return null
}
