import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { SettingsPageContent } from "@/features/settings/components/settings-page-content"

export const metadata: Metadata = {
	title: "Settings",
}

export default function SettingsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Settings"
				description="Manage your account, security, appearance, and notification preferences."
			/>
			<Suspense fallback={<p className="text-muted-foreground text-sm">Loading settings…</p>}>
				<SettingsPageContent />
			</Suspense>
		</div>
	)
}
