import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { EnbAccessRequestContent } from "@/features/enb-access/components/enb-access-request-content"

export const metadata: Metadata = {
	title: "ENB Access",
}

export default function EnbAccessPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Electronic Notarial Book access"
				description="Virtually request to inspect or copy ENB entries through the ENF. Your notary will review and decide on each request."
			/>
			<EnbAccessRequestContent />
		</div>
	)
}
