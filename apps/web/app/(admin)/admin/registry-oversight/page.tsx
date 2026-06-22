import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminRegistryOversightContent } from "@/features/admin/components/admin-registry-oversight-content"

export const metadata: Metadata = {
	title: "Registry Oversight",
}

export default function AdminRegistryOversightPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Registry Oversight"
				description="Monitor notary registries and commission statuses."
			/>
			<AdminRegistryOversightContent />
		</div>
	)
}
