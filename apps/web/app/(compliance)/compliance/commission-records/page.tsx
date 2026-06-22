import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { CommissionRecordsContent } from "@/features/compliance-audit/components/commission-records-content"

export const metadata: Metadata = {
	title: "Commission Records",
}

export default function CommissionRecordsPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="Commission Records" description="Read-only ENP commission data." />
			<CommissionRecordsContent />
		</div>
	)
}
