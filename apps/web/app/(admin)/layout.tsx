import { redirect } from "next/navigation"

import { resolveProtectedSession } from "@/services/better-auth/auth-server"
import { AdminForbidden } from "@/features/admin/components/admin-forbidden"
import { AdminHeader } from "@/features/admin/components/admin-header"
import { SessionRecoveryShell } from "@/features/auth/components/session-recovery-shell"
import { loadEmailMfaStatus } from "@/features/auth/server/load-email-mfa-status"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { AdminSidebar } from "@/features/navigation/components/admin-sidebar"
import type { SiteRole } from "@/features/navigation/nav-config"
import { SiteRealtimeClient } from "@/features/realtime/components/site-realtime-client"

function adminSiteRole(
	role: NonNullable<Awaited<ReturnType<typeof loadDashboardProfile>>>["role"]
): SiteRole {
	switch (role) {
		case "admin":
			return "admin"
		case "super_admin":
			return "super_admin"
		case "sub_org_admin":
			return "admin"
		default:
			return "admin"
	}
}

export default async function AdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const auth = await resolveProtectedSession()

	if (auth.kind === "unauthenticated") {
		redirect("/")
	}

	if (auth.kind === "recoverable") {
		return (
			<SessionRecoveryShell>
				<div className="flex min-h-screen items-center justify-center p-8">
					<p className="text-muted-foreground text-sm">Restoring admin session…</p>
				</div>
			</SessionRecoveryShell>
		)
	}

	const session = auth.session
	const mfa = await loadEmailMfaStatus()
	if (mfa?.mfaVerified === false) {
		redirect("/mfa")
	}

	const profile = await loadDashboardProfile()

	if (
		profile?.role !== "admin" &&
		profile?.role !== "super_admin" &&
		profile?.role !== "sub_org_admin"
	) {
		return <AdminForbidden />
	}

	return (
		<div className="flex min-h-screen">
			<AdminSidebar role={profile ? adminSiteRole(profile.role) : null} />
			<SiteRealtimeClient />
			<div className="flex flex-1 flex-col">
				<AdminHeader userName={session.user.name} userEmail={session.user.email} />
				<main className="flex-1 p-6">{children}</main>
			</div>
		</div>
	)
}
