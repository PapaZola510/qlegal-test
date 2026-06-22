import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminOverviewContent } from "@/features/admin/components/admin-overview-content"

export const metadata: Metadata = {
	title: "Admin",
}

export default function AdminOverviewPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="Admin Overview" description="System-wide metrics and management tools." />
			<AdminOverviewContent />
		</div>
	)
}
