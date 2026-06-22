import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AccessLogContent } from "@/features/compliance-audit/components/access-log-content"

export const metadata: Metadata = {
	title: "Compliance Access Log",
}

export default function ComplianceAccessLogPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="Access Log" description="Tamper-evident access trail." />
			<AccessLogContent />
		</div>
	)
}
