import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminSubOrgsContent } from "@/features/admin/components/admin-sub-orgs-content"

export const metadata: Metadata = {
	title: "Sub-Organizations",
}

export default function AdminSubOrgsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Sub-Organizations"
				description="Manage affiliated organizations and their members."
			/>
			<AdminSubOrgsContent />
		</div>
	)
}
