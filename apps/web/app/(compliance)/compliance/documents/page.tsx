import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { NotarizedDocumentsContent } from "@/features/compliance-audit/components/notarized-documents-content"

export const metadata: Metadata = {
	title: "Notarized Documents",
}

export default async function NotarizedDocumentsPage({
	searchParams,
}: {
	searchParams: Promise<{ enpUserId?: string; bookNo?: string }>
}) {
	const params = await searchParams
	return (
		<div className="space-y-6">
			<PageHeader title="Notarized Documents" description="Read-only registry document view." />
			<NotarizedDocumentsContent
				initialEnpUserId={params.enpUserId}
				initialBookNo={params.bookNo}
			/>
		</div>
	)
}
