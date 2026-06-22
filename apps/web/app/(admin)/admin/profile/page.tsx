import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { ProfilePageContent } from "@/features/profile/components/profile-page-content"

export const metadata: Metadata = {
	title: "Profile",
}

export default function AdminProfilePage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Profile"
				description="Manage your account details and complete identity verification for admin actions."
			/>
			<Suspense fallback={<p className="text-muted-foreground text-sm">Loading profile…</p>}>
				<ProfilePageContent />
			</Suspense>
		</div>
	)
}
