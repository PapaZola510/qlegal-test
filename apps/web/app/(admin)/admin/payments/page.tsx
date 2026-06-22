import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminPaymentsContent } from "@/features/admin/components/admin-payments-content"

export const metadata: Metadata = {
	title: "Payments",
}

export default function AdminPaymentsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Payments"
				description="View and manage payment records with admin overrides."
			/>
			<AdminPaymentsContent />
		</div>
	)
}
