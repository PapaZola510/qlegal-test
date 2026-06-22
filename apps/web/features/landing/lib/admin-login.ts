/** Better Auth email for the landing-page admin username `admin`. */
export const ADMIN_LANDING_EMAIL = "admin@qlegal.local"

export function resolveAdminLandingEmail(username: string): string {
	const trimmed = username.trim()
	if (trimmed.includes("@")) return trimmed.toLowerCase()
	if (trimmed.toLowerCase() === "admin") return ADMIN_LANDING_EMAIL
	return `${trimmed.toLowerCase()}@qlegal.local`
}
