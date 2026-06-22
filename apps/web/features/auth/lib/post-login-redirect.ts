/** Persists return path across Google OAuth (login/register → guest meeting invite links). */
export const POST_LOGIN_REDIRECT_KEY = "qlegal-post-login-redirect"

export function savePostLoginRedirect(path: string) {
	try {
		sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path)
	} catch {
		/* private mode / quota */
	}
}

export function consumePostLoginRedirect(): string | null {
	try {
		const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
		if (value) sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
		return value
	} catch {
		return null
	}
}

export function readPostLoginRedirectFromQuery(
	searchParams: URLSearchParams | null | undefined
): string | null {
	const raw = searchParams?.get("redirect")?.trim()
	if (!raw) return null
	if (!raw.startsWith("/")) return null
	if (raw.startsWith("//")) return null
	return raw
}
