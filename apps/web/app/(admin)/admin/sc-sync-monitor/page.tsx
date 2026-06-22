import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminScSyncContent } from "@/features/admin/components/admin-sc-sync-content"

export const metadata: Metadata = {
	title: "SC Sync Monitor",
}

export default function AdminScSyncMonitorPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="SC Sync Monitor"
				description="Track Supreme Court e-Notarial registry synchronization."
			/>
			<AdminScSyncContent />
		</div>
	)
}
