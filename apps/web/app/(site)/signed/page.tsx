import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { SignedContent } from "@/features/signed/components/signed-content"

export const metadata: Metadata = {
	title: "Signed",
}

export default function SignedPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Signed"
				description="View notarized documents and request certified true copies from your notary."
			/>
			<SignedContent />
		</div>
	)
}
