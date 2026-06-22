import type { UserProfile } from "@repo/contracts"

import { getSession } from "@/services/better-auth/auth-server"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { SiteNav } from "@/features/navigation/components/site-nav"
import type { SiteRole } from "@/features/navigation/nav-config"

/**
 * ENP/client roles live on the auth profile (`/profile/me`), not on the Better Auth session user row
 * (`session.user.role` is unset). Without this mapping, nav always defaulted to the ENP link set.
 */
function siteRoleFromUserProfile(role: UserProfile["role"]): SiteRole {
	switch (role) {
		case "client":
			return "client"
		case "enp":
			return "enp"
		case "admin":
			return "admin"
		case "super_admin":
			return "super_admin"
		case "sub_org_admin":
			return "admin"
		default:
			return "client"
	}
}

export async function SiteNavServer({ children }: { children?: React.ReactNode }) {
	const session = await getSession()
	const user = session
		? { name: session.user.name, email: session.user.email, image: session.user.image }
		: null

	let role: SiteRole | null = null
	if (session) {
		const profile = await loadDashboardProfile()
		if (profile) {
			role = siteRoleFromUserProfile(profile.role)
		}
	}

	return (
		<SiteNav user={user} role={role}>
			{children}
		</SiteNav>
	)
}
