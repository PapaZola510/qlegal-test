import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/core/components/page-header"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { ProfilePageContent } from "@/features/profile/components/profile-page-content"
import { profilePath, usesAdminProfileShell } from "@/features/profile/lib/profile-routes"

export const metadata: Metadata = {
	title: "Profile",
}

export default async function ProfilePage({
	searchParams,
}: {
	searchParams: Promise<{ focus?: string }>
}) {
	const profile = await loadDashboardProfile()
	const { focus } = await searchParams

	if (profile && usesAdminProfileShell(profile.role)) {
		redirect(
			profilePath(profile.role, {
				focus: focus === "kyc" || focus === "notarial" ? focus : undefined,
			})
		)
	}

	return (
		<div className="space-y-6">
			<PageHeader title="Profile" description="Manage your personal information and credentials." />
			<Suspense fallback={<p className="text-muted-foreground text-sm">Loading profile…</p>}>
				<ProfilePageContent />
			</Suspense>
		</div>
	)
}
