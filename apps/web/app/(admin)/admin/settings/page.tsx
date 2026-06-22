import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminMaintenanceSettings } from "@/features/admin/components/admin-maintenance-settings"

export const metadata: Metadata = {
	title: "Settings",
}

export default function AdminSettingsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Settings"
				description="Configure platform settings and schedule maintenance notices."
			/>
			<AdminMaintenanceSettings />
		</div>
	)
}
