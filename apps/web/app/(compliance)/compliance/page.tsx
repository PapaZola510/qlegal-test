import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { ComplianceOverviewContent } from "@/features/compliance-audit/components/compliance-overview-content"

export const metadata: Metadata = {
	title: "Compliance Audit",
}

export default function ComplianceOverviewPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="Compliance Audit" description="Data-sharing audit console." />
			<ComplianceOverviewContent />
		</div>
	)
}
