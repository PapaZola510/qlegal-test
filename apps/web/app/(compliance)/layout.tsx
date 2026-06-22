import { redirect } from "next/navigation"

import { resolveProtectedSession } from "@/services/better-auth/auth-server"
import { SessionRecoveryShell } from "@/features/auth/components/session-recovery-shell"
import { loadEmailMfaStatus } from "@/features/auth/server/load-email-mfa-status"
import { ComplianceForbidden } from "@/features/compliance-audit/components/compliance-forbidden"
import { ComplianceHeader } from "@/features/compliance-audit/components/compliance-header"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { AdminSidebar } from "@/features/navigation/components/admin-sidebar"
import { SiteRealtimeClient } from "@/features/realtime/components/site-realtime-client"

export default async function ComplianceLayout({
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
					<p className="text-muted-foreground text-sm">Restoring compliance session…</p>
				</div>
			</SessionRecoveryShell>
		)
	}

	const mfa = await loadEmailMfaStatus()
	if (mfa?.mfaVerified === false) {
		redirect("/mfa")
	}

	const profile = await loadDashboardProfile()
	const isPlatformOperator = profile?.role === "admin" || profile?.role === "super_admin"
	const allowed = isPlatformOperator || profile?.complianceAuditAccess === true
	if (!allowed) return <ComplianceForbidden />

	const session = auth.session

	return (
		<div className="flex min-h-screen">
			{isPlatformOperator && <AdminSidebar desktopOnly />}
			<SiteRealtimeClient />
			<div className="flex min-w-0 flex-1 flex-col">
				<ComplianceHeader
					userName={session.user.name}
					userEmail={session.user.email}
					showAdminMenu={isPlatformOperator}
				/>
				<main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
			</div>
		</div>
	)
}
