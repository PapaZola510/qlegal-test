import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { EnbInspectContent } from "@/features/compliance-audit/components/enb-inspect-content"

export const metadata: Metadata = {
	title: "Inspect ENB",
}

export default function EnbInspectPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Inspect Electronic Notarial Book"
				description="View all ENB entries for a notary book through the ENF. Data loads automatically; inspect and virtual copy access are logged."
			/>
			<EnbInspectContent />
		</div>
	)
}
