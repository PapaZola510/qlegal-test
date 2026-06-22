import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { ExportsContent } from "@/features/compliance-audit/components/exports-content"

export const metadata: Metadata = {
	title: "Compliance Exports",
}

export default function ComplianceExportsPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="Exports" description="Generate admissible audit exports." />
			<ExportsContent />
		</div>
	)
}
