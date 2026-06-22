/** Better Auth session cookies (see `better-auth.session_token` in devtools). */
const AUTH_SESSION_COOKIE_MARKERS = [
	"better-auth.session_token",
	"better-auth.session_data",
	"__Secure-better-auth.session_token",
] as const

export function hasLikelyAuthSessionCookie(cookieHeader: string): boolean {
	const normalized = cookieHeader.trim().toLowerCase()
	if (!normalized) return false
	return AUTH_SESSION_COOKIE_MARKERS.some(marker => normalized.includes(marker.toLowerCase()))
}
