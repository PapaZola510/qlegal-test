/**
 * Clears Better Auth cookies in the browser.
 *
 * Sign-out removes session cookies server-side but can leave OAuth `state` cookies
 * behind (especially host-only vs `.quanbyai.com` duplicates). Those cause
 * `state_mismatch` on the next Google login while incognito still works.
 */
const BETTER_AUTH_COOKIE_MARKERS = ["better-auth.", "__Secure-better-auth."] as const

const KNOWN_AUTH_COOKIE_NAMES = [
	"better-auth.state",
	"better-auth.oauth_state",
	"better-auth.session_token",
	"better-auth.session_data",
	"better-auth.account_data",
	"better-auth.dont_remember",
	"__Secure-better-auth.state",
	"__Secure-better-auth.oauth_state",
	"__Secure-better-auth.session_token",
	"__Secure-better-auth.session_data",
	"__Secure-better-auth.account_data",
	"__Secure-better-auth.dont_remember",
] as const

function cookieDomainVariants(): Array<string | undefined> {
	if (typeof window === "undefined") return [undefined]

	const { hostname } = window.location
	const variants: Array<string | undefined> = [undefined]

	const labels = hostname.split(".")
	if (labels.length >= 2) {
		variants.push(`.${labels.slice(-2).join(".")}`)
	}
	if (labels.length >= 3) {
		variants.push(`.${labels.slice(-3).join(".")}`)
	}

	return [...new Set(variants)]
}

function expireBrowserCookie(name: string, domain?: string, path = "/") {
	if (typeof document === "undefined") return

	let directive = `${name}=; Max-Age=0; path=${path}`
	if (domain) directive += `; domain=${domain}`
	if (window.location.protocol === "https:") directive += "; Secure"
	document.cookie = directive
}

function collectBetterAuthCookieNames(): string[] {
	if (typeof document === "undefined") return []

	const names = new Set<string>(KNOWN_AUTH_COOKIE_NAMES)

	for (const part of document.cookie.split(";")) {
		const name = part.trim().split("=")[0]?.trim()
		if (!name) continue
		if (BETTER_AUTH_COOKIE_MARKERS.some(marker => name.includes(marker))) {
			names.add(name)
		}
	}

	return [...names]
}

export function clearBetterAuthBrowserCookies() {
	const domains = cookieDomainVariants()
	const paths = ["/", "/api", "/api/v1", "/api/v1/auth"]

	for (const name of collectBetterAuthCookieNames()) {
		for (const domain of domains) {
			for (const path of paths) {
				expireBrowserCookie(name, domain, path)
			}
		}
	}
}
