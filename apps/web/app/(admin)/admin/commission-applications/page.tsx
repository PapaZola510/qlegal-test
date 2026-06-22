import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminCommissionApplicationsContent } from "@/features/admin/components/admin-commission-applications-content"

export const metadata: Metadata = {
	title: "Commission Applications",
}

export default function AdminCommissionApplicationsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Commission applications"
				description="Review electronic notarial commission packages submitted by ENPs."
			/>
			<AdminCommissionApplicationsContent />
		</div>
	)
}
