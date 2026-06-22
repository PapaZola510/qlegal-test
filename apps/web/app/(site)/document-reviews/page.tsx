import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { DocumentReviewsContent } from "@/features/document-review/components/document-reviews-content"

export const metadata: Metadata = {
	title: "Document Reviews",
}

export default function DocumentReviewsPage() {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<PageHeader
				title="Document Reviews"
				description="Track documents you've sent for review, or review documents sent to you."
			/>
			<DocumentReviewsContent />
		</div>
	)
}
