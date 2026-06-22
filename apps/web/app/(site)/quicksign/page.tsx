import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { QuickSignContent } from "@/features/quicksign/components/quicksign-content"

export const metadata: Metadata = {
	title: "QuickSign",
}

export default function QuickSignPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="QuickSign"
				description="Quickly sign and send documents for e-signature."
			/>
			<QuickSignContent />
		</div>
	)
}
