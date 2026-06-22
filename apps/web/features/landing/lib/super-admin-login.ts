/** Better Auth email for the landing-page super admin username `superadmin`. */
export const SUPER_ADMIN_LANDING_EMAIL = "superadmin@qlegal.local"

export function resolveSuperAdminLandingEmail(username: string): string {
	const trimmed = username.trim()
	if (trimmed.includes("@")) return trimmed.toLowerCase()
	if (trimmed.toLowerCase() === "superadmin") return SUPER_ADMIN_LANDING_EMAIL
	return `${trimmed.toLowerCase()}@qlegal.local`
}
