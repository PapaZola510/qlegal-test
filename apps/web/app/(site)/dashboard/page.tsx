import type { Metadata } from "next"

import { ClientRedirect } from "@/core/components/client-redirect"
import { PageHeader } from "@/core/components/page-header"
import { shouldRedirectToOnboarding } from "@/features/auth/lib/should-redirect-to-onboarding"
import { DashboardContent } from "@/features/dashboard/components/dashboard-content"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { env } from "@/env"

export const metadata: Metadata = {
	title: "Dashboard",
}

export default async function DashboardPage() {
	const initialProfile = await loadDashboardProfile()
	const devBypassOnboardingGuard =
		env.NODE_ENV !== "production" && env.NEXT_PUBLIC_CERT_EXAM_DEV_ASSIST === "true"
	if (initialProfile && shouldRedirectToOnboarding(initialProfile) && !devBypassOnboardingGuard) {
		return <ClientRedirect to="/onboarding" />
	}

	const isEnpDashboard =
		initialProfile?.role === "enp" ||
		initialProfile?.role === "admin" ||
		initialProfile?.role === "super_admin" ||
		initialProfile?.role === "sub_org_admin"

	return (
		<div className="space-y-8">
			<PageHeader
				title={isEnpDashboard ? "ENP Dashboard" : "Dashboard"}
				description={
					isEnpDashboard
						? "Certification, KYC, Supreme Court commission status, and shortcuts to appointments and QuickSign."
						: "Account overview and quick access to your work."
				}
			/>
			<DashboardContent initialProfile={initialProfile} />
		</div>
	)
}
