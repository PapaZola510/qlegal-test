import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { EnbsContent } from "@/features/compliance-audit/components/enbs-content"

export const metadata: Metadata = {
	title: "Electronic Notarial Books",
}

export default function EnbsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Electronic Notarial Books"
				description="All electronic notarial books in the platform. Open a book to view every entry for the ENF."
			/>
			<EnbsContent />
		</div>
	)
}
