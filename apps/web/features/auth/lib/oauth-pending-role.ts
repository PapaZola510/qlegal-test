/** Legacy sessionStorage key from when role was chosen before Google OAuth. */
const OAUTH_PENDING_ROLE_KEY = "qlegal_pending_oauth_role" as const

/** Removes stale role preference left over from the old sign-in flow. */
export function clearPendingOAuthRole() {
	if (typeof sessionStorage === "undefined") return
	sessionStorage.removeItem(OAUTH_PENDING_ROLE_KEY)
}
